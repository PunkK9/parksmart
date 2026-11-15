const router = require("express").Router();
const Booking = require("../models/Booking");
const { protect, adminOnly } = require("../middleware/auth");
const wrap = require("../utils/wrap");

const TZ = "Asia/Kolkata";
router.use(protect, adminOnly);

// Shared filters: ?from=YYYY-MM-DD&to=YYYY-MM-DD&zone=A&vehicleType=4-wheeler
function base(q) {
  const match = { status: { $ne: "cancelled" } };
  if (q.from || q.to) {
    match.startTime = {};
    if (q.from) match.startTime.$gte = new Date(`${q.from}T00:00:00+05:30`);
    if (q.to) match.startTime.$lte = new Date(`${q.to}T23:59:59.999+05:30`);
  }
  if (q.vehicleType) match.vehicleType = q.vehicleType;
  const p = [
    { $match: match },
    { $lookup: { from: "slots", localField: "slot", foreignField: "_id", as: "slotDoc" } },
    { $unwind: "$slotDoc" },
  ];
  if (q.zone) p.push({ $match: { "slotDoc.zone": q.zone } });
  return p;
}

router.get("/summary", wrap(async (req, res) => {
  const [r] = await Booking.aggregate([
    ...base(req.query),
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        active: { $sum: { $cond: [{ $in: ["$status", ["booked", "checked_in"]] }, 1, 0] } },
        revenue: { $sum: "$fee" },
      },
    },
  ]);
  res.json(r ? { total: r.total, completed: r.completed, active: r.active, revenue: r.revenue }
             : { total: 0, completed: 0, active: 0, revenue: 0 });
}));

// Heatmap: day of week (1 = Sunday ... 7 = Saturday) x hour of day
router.get("/heatmap", wrap(async (req, res) => {
  res.json(
    await Booking.aggregate([
      ...base(req.query),
      {
        $group: {
          _id: {
            dow: { $dayOfWeek: { date: "$startTime", timezone: TZ } },
            hour: { $hour: { date: "$startTime", timezone: TZ } },
          },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, dow: "$_id.dow", hour: "$_id.hour", count: 1 } },
    ])
  );
}));

router.get("/revenue-daily", wrap(async (req, res) => {
  res.json(
    await Booking.aggregate([
      ...base(req.query),
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime", timezone: TZ } },
          revenue: { $sum: "$fee" },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", revenue: 1, bookings: 1 } },
    ])
  );
}));

router.get("/by-zone", wrap(async (req, res) => {
  res.json(
    await Booking.aggregate([
      ...base(req.query),
      { $group: { _id: "$slotDoc.zone", bookings: { $sum: 1 }, revenue: { $sum: "$fee" } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, zone: "$_id", bookings: 1, revenue: 1 } },
    ])
  );
}));

module.exports = router;
