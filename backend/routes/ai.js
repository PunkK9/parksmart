const router = require("express").Router();
const Booking = require("../models/Booking");
const Slot = require("../models/Slot");
const { protect } = require("../middleware/auth");
const { getDemand, hourOf } = require("../utils/demand");
const { RATE, multiplierForLevel } = require("../utils/pricing");
const { recommendSlots } = require("../utils/recommend");
const { forecastOccupancy } = require("../utils/forecast");
const wrap = require("../utils/wrap");

router.use(protect);

const fmt = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

// Favorite slot = the slot this user has booked most often (simple frequency count).
async function favoriteSlot(userId) {
  const r = await Booking.aggregate([
    { $match: { user: userId, status: { $ne: "cancelled" } } },
    { $group: { _id: "$slot", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]);
  if (!r.length) return null;
  const slot = await Slot.findById(r[0]._id);
  return slot ? { slot, count: r[0].count } : null;
}

// Dynamic convenience fee: base rate scaled by the demand level of the current hour.
async function currentFee(vehicleType) {
  const d = await getDemand();
  const level = d.levels[hourOf(new Date())];
  const multiplier = multiplierForLevel(level);
  return {
    level,
    multiplier,
    base: RATE[vehicleType],
    perHour: Math.round(RATE[vehicleType] * multiplier),
  };
}

router.get("/prediction", wrap(async (req, res) => res.json(await getDemand())));

router.get("/fee", wrap(async (req, res) => {
  const vt = req.query.vehicleType === "2-wheeler" ? "2-wheeler" : "4-wheeler";
  res.json(await currentFee(vt));
}));

router.get("/favorite-slot", wrap(async (req, res) => {
  res.json(await favoriteSlot(req.user._id));
}));

router.get("/recommend", wrap(async (req, res) => {
  const vt = req.query.vehicleType === "2-wheeler" ? "2-wheeler" : "4-wheeler";
  res.json(await recommendSlots(req.user._id, vt));
}));

router.get("/forecast", wrap(async (req, res) => {
  res.json(await forecastOccupancy());
}));

// Rule/keyword chatbot over the same booking data. Not a language model.
router.post("/chat", wrap(async (req, res) => {
  const msg = (req.body.message || "").toLowerCase().trim();
  if (!msg) return res.status(400).json({ message: "Type a question first" });
  let reply;

  const codeMatch = msg.match(/\b([a-z]\d{1,2})\b/);
  const slotByCode = codeMatch ? await Slot.findOne({ code: codeMatch[1].toUpperCase() }) : null;

  if (slotByCode) {
    const isAvail = slotByCode.status === "available";
    reply = `Slot ${slotByCode.code} (${slotByCode.zone} Zone, dedicated for ${slotByCode.vehicleType}) is currently ${slotByCode.status.toUpperCase()}.${isAvail ? " You can book it now from the Book a Bay page." : ""}`;
  } else if (/^(hi|hello|hey|greetings|help)\b/.test(msg)) {
    reply = "Hi! I can tell you which bays are free, when it's least busy, what parking costs right now, and how to find the gate.";
  } else if (/favou?rite|usual|regular|preferred/.test(msg)) {
    const f = await favoriteSlot(req.user._id);
    reply = f
      ? `Your most frequented slot is ${f.slot.code} in Zone ${f.slot.zone}. You have reserved it ${f.count} time${f.count > 1 ? "s" : ""}, and it is currently ${f.slot.status.toUpperCase()}.`
      : "You don't have enough booking history yet. Once you make a couple of bookings, I'll identify your favorite bay!";
  } else if (/entrance|gate|location|where is|navigate|direction|reach/.test(msg)) {
    reply = "The main gate is at 13.0293° N, 77.5641° E. After you book, open 'My Bookings' and tap 'Directions' to see your bay on the map with the distance and direction from the gate.";
  } else if (/check[- ]?in|check[- ]?out|how to scan|qr code|gate/.test(msg)) {
    reply = "To check in, arrive at the entrance gate and scan your booking's digital QR pass. Your bay then shows as occupied. When leaving, scan the QR code again to check out and pay the exact hourly fee.";
  } else if (/cancel|refund/.test(msg)) {
    reply = "You can cancel any booking free of charge from 'My Bookings' as long as you haven't checked in yet at the gate.";
  } else if (/peak|busy|crowd|best time|when to arrive|quiet|traffic/.test(msg)) {
    const d = await getDemand();
    reply = d.hasData
      ? `Based on our 60-day moving average, peak rush hours are ${d.peakHours.map(fmt).join(", ") || "normally distributed"}. The least crowded and best times to park are ${d.bestHours.map(fmt).join(", ")}.`
      : "There isn't enough booking history yet to tell the peak hours.";
  } else if (/fee|price|cost|charge|rate|pay|surge|tariff/.test(msg)) {
    const vt = /bike|scooter|two|2-?wheel/.test(msg) ? "2-wheeler" : "4-wheeler";
    const f = await currentFee(vt);
    reply = `Current ${vt} rate is ₹${f.perHour}/hr (Standard base rate: ₹${f.base}/hr, demand multiplier: ${f.multiplier}x for ${f.level.toUpperCase()} demand).`;
  } else if (/my booking|my slot|active booking|ticket|pass/.test(msg)) {
    const b = await Booking.findOne({
      user: req.user._id,
      status: { $in: ["booked", "checked_in"] },
    }).populate("slot");
    reply = b
      ? `You hold an active reservation for Slot ${b.slot.code} (Zone ${b.slot.zone}, ${b.slot.vehicleType}). Status: ${b.status.replace("_", " ").toUpperCase()}. Vehicle: ${b.vehicleNumber}.`
      : "You currently have no active booking. You can book a free bay from the Book a Bay page.";
  } else if (/free|available|vacant|space|slot|empty|open/.test(msg)) {
    const f = { status: "available" };
    const z = msg.match(/zone\s*([a-z])\b/);
    if (z) f.zone = z[1].toUpperCase();
    if (/bike|scooter|two|2-?wheel/.test(msg)) f.vehicleType = "2-wheeler";
    else if (/car|four|4-?wheel/.test(msg)) f.vehicleType = "4-wheeler";
    const rows = await Slot.aggregate([
      { $match: f },
      { $group: { _id: "$zone", n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    reply = rows.length
      ? "Free bays right now: " + rows.map((r) => `Zone ${r._id}: ${r.n} free`).join(" · ") + "."
      : "All slots matching your criteria are currently occupied or reserved.";
  } else {
    reply =
      "I'm here to assist with: checking slot status ('Is A3 free?'), finding free bays ('Any free slot in zone B?'), fees ('What is the car rate?'), arrival recommendations ('Best time to park?'), and checking active passes.";
  }

  res.json({ reply });
}));

module.exports = router;
