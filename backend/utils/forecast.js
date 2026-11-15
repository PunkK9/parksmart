const Booking = require("../models/Booking");
const Slot = require("../models/Slot");

const TZ = "Asia/Kolkata";
const HORIZON_MIN = 20;
const LOOKBACK_DAYS = 28;

function parts(date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    weekday: "short",
  });
  const bag = {};
  fmt.formatToParts(date).forEach((p) => {
    bag[p.type] = p.value;
  });
  return { hour: Number(bag.hour) % 24, minute: Number(bag.minute), weekday: bag.weekday };
}

async function forecastOccupancy() {
  const now = new Date();
  const soon = new Date(now.getTime() + HORIZON_MIN * 60 * 1000);
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const startParts = parts(now);
  const endParts = parts(soon);
  const startMin = startParts.hour * 60 + startParts.minute;
  const endMin = endParts.hour * 60 + endParts.minute;
  const wraps = endMin < startMin;

  const [slots, arrivals, departures, stays] = await Promise.all([
    Slot.find().lean(),
    Booking.aggregate([
      { $match: { startTime: { $gte: since }, status: { $ne: "cancelled" } } },
      {
        $project: {
          slot: 1,
          minuteOfDay: {
            $add: [
              { $multiply: [{ $hour: { date: "$startTime", timezone: TZ } }, 60] },
              { $minute: { date: "$startTime", timezone: TZ } },
            ],
          },
        },
      },
      {
        $lookup: { from: "slots", localField: "slot", foreignField: "_id", as: "slotDoc" },
      },
      { $unwind: "$slotDoc" },
      {
        $match: wraps
          ? { $or: [{ minuteOfDay: { $gte: startMin } }, { minuteOfDay: { $lt: endMin } }] }
          : { minuteOfDay: { $gte: startMin, $lt: endMin } },
      },
      { $group: { _id: "$slotDoc.zone", count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      {
        $match: {
          checkOutTime: { $gte: since },
          status: "completed",
        },
      },
      {
        $project: {
          slot: 1,
          minuteOfDay: {
            $add: [
              { $multiply: [{ $hour: { date: "$checkOutTime", timezone: TZ } }, 60] },
              { $minute: { date: "$checkOutTime", timezone: TZ } },
            ],
          },
        },
      },
      { $lookup: { from: "slots", localField: "slot", foreignField: "_id", as: "slotDoc" } },
      { $unwind: "$slotDoc" },
      {
        $match: wraps
          ? { $or: [{ minuteOfDay: { $gte: startMin } }, { minuteOfDay: { $lt: endMin } }] }
          : { minuteOfDay: { $gte: startMin, $lt: endMin } },
      },
      { $group: { _id: "$slotDoc.zone", count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { status: "completed", checkInTime: { $ne: null }, checkOutTime: { $ne: null } } },
      {
        $group: {
          _id: null,
          avgMs: { $avg: { $subtract: ["$checkOutTime", "$checkInTime"] } },
        },
      },
    ]),
  ]);

  const arrivalMap = new Map(arrivals.map((r) => [r._id, r.count / LOOKBACK_DAYS]));
  const departMap = new Map(departures.map((r) => [r._id, r.count / LOOKBACK_DAYS]));
  const avgStayMin = stays[0]?.avgMs ? stays[0].avgMs / 60000 : 90;
  const freeChance = Math.min(0.85, HORIZON_MIN / Math.max(30, avgStayMin));

  const zones = {};
  slots.forEach((s) => {
    const z = zones[s.zone] || { zone: s.zone, total: 0, taken: 0, occupied: 0 };
    z.total += 1;
    if (s.status === "reserved" || s.status === "occupied") z.taken += 1;
    if (s.status === "occupied") z.occupied += 1;
    zones[s.zone] = z;
  });

  const rows = Object.values(zones)
    .sort((a, b) => a.zone.localeCompare(b.zone))
    .map((z) => {
      const expectedIn = arrivalMap.get(z.zone) || 0;
      const expectedOut = (departMap.get(z.zone) || 0) + z.occupied * freeChance;
      const openCapacity = Math.max(0, z.total - z.taken);
      const predictedTaken = Math.max(
        0,
        Math.min(z.total, Math.round(z.taken + Math.min(expectedIn, openCapacity) - Math.min(expectedOut, z.taken)))
      );
      const nowPct = z.total ? Math.round((z.taken / z.total) * 100) : 0;
      const predictedPct = z.total ? Math.round((predictedTaken / z.total) * 100) : 0;
      return {
        ...z,
        nowPct,
        predictedTaken,
        predictedPct,
        expectedArrivals: +expectedIn.toFixed(2),
      };
    });

  const rising = [...rows].sort((a, b) => b.predictedPct - b.nowPct - (a.predictedPct - a.nowPct));
  const lead = rising[0];
  const headline = lead
    ? `Zone ${lead.zone} will be ~${lead.predictedPct}% full in ${HORIZON_MIN} min`
    : "Not enough bays to forecast occupancy";

  return { horizonMin: HORIZON_MIN, generatedAt: now.toISOString(), headline, zones: rows };
}

module.exports = { forecastOccupancy, HORIZON_MIN };
