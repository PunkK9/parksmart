const router = require("express").Router();
const crypto = require("crypto");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Slot = require("../models/Slot");
const { protect, adminOnly } = require("../middleware/auth");
const { getDemand, hourOf } = require("../utils/demand");
const { computeFee, multiplierForLevel } = require("../utils/pricing");
const { broadcastSlots, notifyUser } = require("../utils/realtime");
const { sendHoldReleased } = require("../utils/mailer");
const wrap = require("../utils/wrap");

const PLATE_RE = /^[A-Z0-9 -]{4,14}$/;

// Unclaimed reservations free the bay after this window.
const RESERVATION_HOLD_MINUTES = 15;
const GATE_ROLES = ["admin", "staff"];

/**
 * Sweep expired reservations that were booked but never checked in.
 * Releases slots automatically to prevent abandoned bays from remaining locked.
 */
async function sweepExpiredBookings() {
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - RESERVATION_HOLD_MINUTES * 60 * 1000);
    const expired = await Booking.find({
      status: "booked",
      $or: [
        { expiresAt: { $lte: now } },
        { expiresAt: { $exists: false }, createdAt: { $lt: cutoff } },
      ],
    })
      .populate("slot", "code zone")
      .populate("user", "name email");

    if (!expired.length) return;

    for (const b of expired) {
      b.status = "cancelled";
      await b.save();
      await Slot.findByIdAndUpdate(b.slot?._id || b.slot, { status: "available" }).catch(() => {});

      const userId = b.user?._id || b.user;
      const slotCode = b.slot?.code || "your bay";
      const message = `Your hold on bay ${slotCode} expired after ${RESERVATION_HOLD_MINUTES} minutes without check-in. The bay is free again.`;
      notifyUser(userId, "booking:released", {
        bookingId: b._id,
        slotCode,
        message,
      });
      if (b.user?.email) {
        sendHoldReleased({ to: b.user.email, name: b.user.name, slotCode }).catch((e) =>
          console.error("[Orbit Sweep] Release email failed:", e.message)
        );
      }
    }
    await broadcastSlots();
    console.log(`[Orbit Sweep] Released ${expired.length} abandoned reservations.`);
  } catch (err) {
    console.error("[Orbit Sweep] Error sweeping expired reservations:", err.message);
  }
}

// Create a booking with ACID Concurrency Control & Double Booking Prevention
router.post("/", protect, wrap(async (req, res) => {
  const { slotId, startTime } = req.body;
  const vehicleNumber = (req.body.vehicleNumber || "").trim().toUpperCase();

  if (!slotId) return res.status(400).json({ message: "Select a parking bay" });
  if (!PLATE_RE.test(vehicleNumber))
    return res.status(400).json({ message: "Enter a valid vehicle registration number" });

  // Sweep any stale expired reservations first
  await sweepExpiredBookings();

  // 1. Check if user already has an active reservation
  const activeBooking = await Booking.findOne({
    user: req.user._id,
    status: { $in: ["booked", "checked_in"] },
  });
  if (activeBooking) {
    return res.status(409).json({
      message: "You already have an active pass. Complete or cancel your existing session first.",
    });
  }

  // 2. Multi-Document ACID Transaction with Atomic Fallback
  let session = null;
  let useTransaction = false;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransaction = true;
  } catch (sessErr) {
    // If running on standalone MongoDB without replica set, fall back to atomic compensation
    session = null;
    useTransaction = false;
  }

  let slot = null;
  try {
    const queryOptions = useTransaction ? { session, new: true } : { new: true };

    // Atomically find slot ONLY if status is 'available' and mark it 'reserved'
    slot = await Slot.findOneAndUpdate(
      { _id: slotId, status: "available" },
      { status: "reserved" },
      queryOptions
    );

    if (!slot) {
      if (useTransaction) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(409).json({
        message: "That bay was just claimed by another vehicle. Please select another vacant bay.",
      });
    }

    const expiresAt = new Date(Date.now() + RESERVATION_HOLD_MINUTES * 60 * 1000);

    const bookingData = {
      user: req.user._id,
      slot: slot._id,
      vehicleNumber,
      vehicleType: slot.vehicleType,
      startTime: startTime ? new Date(startTime) : new Date(),
      expiresAt,
      qrToken: crypto.randomBytes(16).toString("hex"),
      status: "booked",
    };

    let booking;
    if (useTransaction) {
      const [created] = await Booking.create([bookingData], { session });
      booking = created;
      await session.commitTransaction();
      session.endSession();
    } else {
      booking = await Booking.create(bookingData);
    }

    const populated = await Booking.findById(booking._id).populate("slot");
    await broadcastSlots();
    return res.status(201).json(populated);
  } catch (err) {
    if (useTransaction && session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (_) {}
    }

    // Safety net: If booking creation failed after slot was claimed, release slot back to 'available'
    if (slot && slot._id) {
      await Slot.findByIdAndUpdate(slot._id, { status: "available" }).catch(() => {});
    }

    // Handle database-level unique partial index collision (E11000)
    if (err.code === 11000 || (err.message && err.message.includes("E11000"))) {
      const key = Object.keys(err.keyPattern || err.keyValue || {})[0];
      return res.status(409).json({
        message:
          key === "user"
            ? "You already have an active pass. Complete or cancel it first."
            : "That bay was just claimed. Please choose another bay.",
      });
    }

    throw err;
  }
}));

router.get("/mine", protect, wrap(async (req, res) => {
  // Run sweep on retrieval
  sweepExpiredBookings().catch(() => {});
  res.json(
    await Booking.find({ user: req.user._id })
      .populate("slot")
      .sort({ createdAt: -1 })
      .limit(100)
  );
}));

router.get("/", protect, adminOnly, wrap(async (req, res) => {
  const f = req.query.status ? { status: req.query.status } : {};
  res.json(
    await Booking.find(f)
      .populate("slot")
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(200)
  );
}));

// QR scan at the gate: first scan checks in, second scan checks out and bills the fee.
router.post("/scan", protect, wrap(async (req, res) => {
  const booking = await Booking.findOne({ qrToken: (req.body.qrToken || "").trim() }).populate("slot");
  if (!booking) return res.status(404).json({ message: "Invalid or unrecognized QR token" });
  const owns = String(booking.user) === String(req.user._id);
  if (!owns && !GATE_ROLES.includes(req.user.role))
    return res.status(403).json({ message: "This QR token belongs to another account" });

  if (booking.status === "booked") {
    booking.status = "checked_in";
    booking.checkInTime = new Date();
    await booking.save();
    await Slot.findByIdAndUpdate(booking.slot._id, { status: "occupied" });
    await broadcastSlots();
    return res.json({ action: "checked_in", booking });
  }

  if (booking.status === "checked_in") {
    const now = new Date();
    const hours = (now - booking.checkInTime) / 3600000;
    const demand = await getDemand();
    const level = demand.levels[hourOf(booking.checkInTime)];
    booking.fee = computeFee(booking.vehicleType, hours, multiplierForLevel(level));
    booking.checkOutTime = now;
    booking.status = "completed";
    await booking.save();
    await Slot.findByIdAndUpdate(booking.slot._id, { status: "available" });
    await broadcastSlots();
    return res.json({ action: "checked_out", booking });
  }

  res.status(400).json({ message: `This booking is already ${booking.status.replace("_", " ")}` });
}));

// Cancel (only before check-in)
router.put("/:id/cancel", protect, wrap(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Booking record not found" });
  if (String(booking.user) !== String(req.user._id))
    return res.status(403).json({ message: "Not your booking" });
  if (booking.status !== "booked")
    return res.status(400).json({ message: "Only reservations that haven't been checked in can be cancelled" });

  booking.status = "cancelled";
  await booking.save();
  await Slot.findByIdAndUpdate(booking.slot, { status: "available" });
  await broadcastSlots();
  res.json(booking);
}));

module.exports = router;
module.exports.sweepExpiredBookings = sweepExpiredBookings;
module.exports.RESERVATION_HOLD_MINUTES = RESERVATION_HOLD_MINUTES;
