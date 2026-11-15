const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  zone: { type: String, required: true, trim: true, uppercase: true },
  vehicleType: { type: String, enum: ["2-wheeler", "4-wheeler"], default: "4-wheeler" },
  status: {
    type: String,
    enum: ["available", "reserved", "occupied", "maintenance"],
    default: "available",
  },
  lat: Number,
  lng: Number,
});

module.exports = mongoose.model("Slot", slotSchema);
