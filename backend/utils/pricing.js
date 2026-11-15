// Base hourly rates in rupees. The AI demand level scales them (dynamic convenience fee).
const RATE = { "4-wheeler": 20, "2-wheeler": 10 };

const multiplierForLevel = (level) => (level === "peak" ? 1.5 : level === "low" ? 0.8 : 1);

// Billed per started hour, minimum one hour.
const computeFee = (vehicleType, hours, multiplier = 1) =>
  Math.round(RATE[vehicleType] * Math.max(1, Math.ceil(hours)) * multiplier);

module.exports = { RATE, multiplierForLevel, computeFee };
