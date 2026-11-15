const router = require("express").Router();
const Slot = require("../models/Slot");
const Booking = require("../models/Booking");
const { protect, adminOnly } = require("../middleware/auth");
const { broadcastSlots } = require("../utils/realtime");
const wrap = require("../utils/wrap");

router.get("/", protect, wrap(async (req, res) => {
  const f = {};
  ["zone", "vehicleType", "status"].forEach((k) => req.query[k] && (f[k] = req.query[k]));
  const slots = await Slot.find(f)
    .sort({ zone: 1, code: 1 })
    .collation({ locale: "en", numericOrdering: true });
  res.json(slots);
}));

router.post("/", protect, adminOnly, wrap(async (req, res) => {
  const { code, zone, vehicleType, lat, lng } = req.body;
  if (!code || !zone) return res.status(400).json({ message: "Slot code and zone are required" });
  try {
    const slot = await Slot.create({
      code,
      zone,
      vehicleType,
      lat: lat === "" ? undefined : lat,
      lng: lng === "" ? undefined : lng,
    });
    await broadcastSlots();
    res.status(201).json(slot);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "A slot with that code already exists" });
    throw e;
  }
}));

router.put("/:id", protect, adminOnly, wrap(async (req, res) => {
  const slot = await Slot.findById(req.params.id);
  if (!slot) return res.status(404).json({ message: "Slot not found" });
  // Don't let an admin flip a slot that has a live booking.
  if (["reserved", "occupied"].includes(slot.status))
    return res.status(409).json({ message: "This slot has an active booking" });
  const allowed = ["status", "zone", "vehicleType", "lat", "lng"];
  allowed.forEach((k) => req.body[k] !== undefined && (slot[k] = req.body[k]));
  if (!["available", "maintenance"].includes(slot.status))
    return res.status(400).json({ message: "Status can only be set to available or maintenance" });
  await slot.save();
  await broadcastSlots();
  res.json(slot);
}));

router.delete("/:id", protect, adminOnly, wrap(async (req, res) => {
  const slot = await Slot.findById(req.params.id);
  if (!slot) return res.status(404).json({ message: "Slot not found" });
  if (["reserved", "occupied"].includes(slot.status))
    return res.status(409).json({ message: "This slot has an active booking" });
  if (await Booking.exists({ slot: slot._id }))
    return res.status(409).json({ message: "This slot has booking history. Set it to maintenance instead." });
  await slot.deleteOne();
  await broadcastSlots();
  res.json({ message: "Slot deleted" });
}));

module.exports = router;
