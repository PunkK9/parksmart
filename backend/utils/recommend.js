const Booking = require("../models/Booking");
const Slot = require("../models/Slot");
const { haversine } = require("./geo");
const { getDemand, hourOf } = require("./demand");

const ENTRANCE = { lat: 13.0293, lng: 77.5641 };

async function recommendSlots(userId, vehicleType) {
  const vt = vehicleType === "2-wheeler" ? "2-wheeler" : "4-wheeler";
  const [open, all, history, demand] = await Promise.all([
    Slot.find({ status: "available", vehicleType: vt }).lean(),
    Slot.find({ vehicleType: vt }).lean(),
    Booking.aggregate([
      { $match: { user: userId, status: { $ne: "cancelled" }, vehicleType: vt } },
      { $group: { _id: "$slot", count: { $sum: 1 } } },
    ]),
    getDemand(),
  ]);

  const freq = new Map(history.map((h) => [String(h._id), h.count]));
  const maxFreq = Math.max(1, ...freq.values(), 1);

  const byZone = {};
  all.forEach((s) => {
    const z = byZone[s.zone] || { total: 0, open: 0 };
    z.total += 1;
    if (s.status === "available") z.open += 1;
    byZone[s.zone] = z;
  });

  const level = demand.levels[hourOf(new Date())] || "normal";
  const distanceWeight = level === "peak" ? 0.45 : 0.32;

  const ranked = open
    .map((slot) => {
      const meters = haversine(ENTRANCE, slot);
      const distanceScore = meters == null ? 0.45 : 1 - Math.min(meters / 350, 1);
      const times = freq.get(String(slot._id)) || 0;
      const historyScore = times / maxFreq;
      const zone = byZone[slot.zone] || { total: 1, open: 1 };
      const openness = zone.open / zone.total;
      const score =
        distanceScore * distanceWeight +
        historyScore * 0.38 +
        openness * (1 - distanceWeight - 0.38);

      const reasons = [];
      if (meters != null && meters <= 80) reasons.push(`${Math.round(meters)} m from the gate`);
      else if (meters != null) reasons.push(`${Math.round(meters)} m walk from the gate`);
      if (times > 0) reasons.push(`You have used this bay ${times} time${times > 1 ? "s" : ""}`);
      if (openness >= 0.5) reasons.push(`Zone ${slot.zone} still has room`);
      else reasons.push(`Zone ${slot.zone} is filling up`);
      if (level === "peak") reasons.push("Closer bays rank higher while demand is peak");

      return { slot, score: +score.toFixed(3), distanceM: meters == null ? null : Math.round(meters), reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return { vehicleType: vt, demandLevel: level, picks: ranked };
}

module.exports = { recommendSlots, ENTRANCE };
