const Booking = require("../models/Booking");

const TZ = "Asia/Kolkata";

const hourOf = (d) =>
  Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(d)
  ) % 24;

// The "AI" module: counts bookings per hour of day over the last N days, smooths the
// counts with a 3-hour circular moving average, then labels each hour peak / normal / low.
async function getDemand(days = 60) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await Booking.aggregate([
    { $match: { startTime: { $gte: since }, status: { $ne: "cancelled" } } },
    { $group: { _id: { $hour: { date: "$startTime", timezone: TZ } }, count: { $sum: 1 } } },
  ]);

  const counts = Array(24).fill(0);
  rows.forEach((r) => (counts[r._id] = r.count));

  const smoothed = counts.map(
    (_, i) => (counts[(i + 23) % 24] + counts[i] + counts[(i + 1) % 24]) / 3
  );
  const mean = smoothed.reduce((a, b) => a + b, 0) / 24;
  const levels = smoothed.map((v) =>
    mean === 0 ? "normal" : v >= 1.2 * mean ? "peak" : v <= 0.8 * mean ? "low" : "normal"
  );
  const peakHours = levels.map((l, h) => (l === "peak" ? h : null)).filter((h) => h !== null);

  // Three quietest hours between 6 AM and 10 PM
  const bestHours = [...Array(17).keys()]
    .map((i) => i + 6)
    .sort((a, b) => smoothed[a] - smoothed[b])
    .slice(0, 3)
    .sort((a, b) => a - b);

  return {
    counts,
    smoothed: smoothed.map((v) => +v.toFixed(2)),
    levels,
    peakHours,
    bestHours,
    hasData: mean > 0,
  };
}

module.exports = { getDemand, hourOf };
