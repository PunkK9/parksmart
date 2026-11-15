const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: "Slot", required: true },
    vehicleNumber: { type: String, required: true, uppercase: true, trim: true },
    vehicleType: { type: String, enum: ["2-wheeler", "4-wheeler"], required: true },
    startTime: { type: Date, required: true },
    checkInTime: Date,
    checkOutTime: Date,
    status: {
      type: String,
      enum: ["booked", "checked_in", "completed", "cancelled"],
      default: "booked",
    },
    fee: { type: Number, default: 0 },
    qrToken: { type: String, unique: true, sparse: true },
    expiresAt: Date, // Auto-expiration deadline for unclaimed reservations
  },
  { timestamps: true }
);

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ startTime: 1 });

// Concurrency Guarantee: Database-level partial unique index
// Ensures that NO slot can ever have more than one active booking (status: 'booked' or 'checked_in')
// One live session per bay, and one live session per driver.
bookingSchema.index(
  { slot: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["booked", "checked_in"] } },
  }
);
bookingSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["booked", "checked_in"] } },
  }
);

module.exports = mongoose.model("Booking", bookingSchema);
