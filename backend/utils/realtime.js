const Slot = require("../models/Slot");

let io = null;

function initRealtime(serverIo) {
  io = serverIo;
}

async function loadSlots() {
  return Slot.find()
    .sort({ zone: 1, code: 1 })
    .collation({ locale: "en", numericOrdering: true })
    .lean();
}

async function broadcastSlots() {
  if (!io) return;
  try {
    const slots = await loadSlots();
    io.to("slots").emit("slots:sync", slots);
    return slots;
  } catch (err) {
    console.error("Slot broadcast failed:", err.message);
  }
}

function notifyUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${String(userId)}`).emit(event, payload);
}

module.exports = { initRealtime, loadSlots, broadcastSlots, notifyUser };
