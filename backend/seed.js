// Fills the database with realistic fake data: users, slots, ~400 past bookings with
// morning and evening peaks, plus a few live bookings. Run with: npm run seed
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("./models/User");
const Slot = require("./models/Slot");
const Booking = require("./models/Booking");
const { computeFee } = require("./utils/pricing");

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// Relative chance of a booking starting in each hour (0-23): peaks around 9 AM and 5 PM.
const WEIGHTS = [0.2, 0.1, 0.1, 0.1, 0.2, 0.4, 1, 2, 5, 6, 5, 3, 3, 3, 3, 3, 5, 6, 5, 3, 2, 1, 0.5, 0.3];
const PEAK = [8, 9, 10, 16, 17, 18];
const LETTERS = [..."ABCDEFGHJKLMNPRSTUVWXYZ"];

// Facility location. Change these to your campus. Keep frontend/src/config.js in sync.
const BASE = { lat: 13.0305, lng: 77.5648 };

function weightedHour() {
  let r = Math.random() * WEIGHTS.reduce((a, b) => a + b, 0);
  for (let h = 0; h < 24; h++) {
    r -= WEIGHTS[h];
    if (r <= 0) return h;
  }
  return 12;
}
const plate = () =>
  `KA${String(rand(1, 60)).padStart(2, "0")}${pick(LETTERS)}${pick(LETTERS)}${rand(1000, 9999)}`;

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing. Copy .env.example to .env first.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.deleteMany({}), Slot.deleteMany({}), Booking.deleteMany({})]);

  // Users (all pre-verified so you can log in straight away)
  await User.create({
    name: "Orbit Administrator",
    email: "admin@orbit.io",
    password: await bcrypt.hash("admin123", 10),
    role: "admin",
    emailVerified: true,
  });

  await User.create({
    name: "Admin (ParkSmart Legacy)",
    email: "admin@parksmart.com",
    password: await bcrypt.hash("admin123", 10),
    role: "admin",
    emailVerified: true,
  });
  const pw = await bcrypt.hash("password123", 10);
  const names = ["Rahul", "Priya", "Arjun", "Sneha", "Kiran", "Meera", "Vikram", "Ananya"];
  const users = await User.insertMany(
    names.map((n, i) => ({
      name: n,
      email: `${n.toLowerCase()}@example.com`,
      password: pw,
      role: i % 4 === 0 ? "staff" : "student",
      emailVerified: true,
    }))
  );

  // Slots: zones A and B are for cars, zone C is for bikes
  const slotDocs = [];

  // Zone A: Executive 4-Wheeler Bays (2 parallel rows of 5 bays each)
  for (let i = 1; i <= 10; i++) {
    const row = i <= 5 ? 0 : 1;
    const col = (i - 1) % 5;
    slotDocs.push({
      code: `A${i}`,
      zone: "A",
      vehicleType: "4-wheeler",
      lat: +(13.03030 + row * 0.00014).toFixed(6),
      lng: +(77.56450 + col * 0.000075).toFixed(6),
    });
  }

  // Zone B: Standard 4-Wheeler Bays (2 parallel rows of 5 bays each)
  for (let i = 1; i <= 10; i++) {
    const row = i <= 5 ? 0 : 1;
    const col = (i - 1) % 5;
    slotDocs.push({
      code: `B${i}`,
      zone: "B",
      vehicleType: "4-wheeler",
      lat: +(13.03065 + row * 0.00014).toFixed(6),
      lng: +(77.56455 + col * 0.000075).toFixed(6),
    });
  }

  // Zone C: Covered 2-Wheeler / Motorcycle Bays (2 rows of 6 bays each)
  for (let i = 1; i <= 12; i++) {
    const row = i <= 6 ? 0 : 1;
    const col = (i - 1) % 6;
    slotDocs.push({
      code: `C${i}`,
      zone: "C",
      vehicleType: "2-wheeler",
      lat: +(13.02990 + row * 0.00010).toFixed(6),
      lng: +(77.56435 + col * 0.000055).toFixed(6),
    });
  }

  const slots = await Slot.insertMany(slotDocs);

  // Every user has one vehicle and a favourite slot
  const profile = {};
  users.forEach((u, i) => {
    const vt = i % 2 === 0 ? "4-wheeler" : "2-wheeler";
    profile[u._id] = { vt, plate: plate(), pref: pick(slots.filter((s) => s.vehicleType === vt)) };
  });

  // Overlap guard: a slot or a user can't have two bookings at the same time
  const busy = {};
  const isFree = (key, s, e) => !(busy[key] || []).some(([a, b]) => s < b && e > a);
  const take = (key, s, e) => (busy[key] = busy[key] || []).push([s, e]);

  const docs = [];
  let tries = 0;
  while (docs.length < 400 && tries < 8000) {
    tries++;
    const u = pick(users);
    const p = profile[u._id];
    const slot = Math.random() < 0.5 ? p.pref : pick(slots.filter((s) => s.vehicleType === p.vt));

    const start = new Date();
    start.setDate(start.getDate() - rand(1, 60));
    start.setHours(weightedHour(), rand(0, 59), 0, 0);
    const durMin = rand(45, 240);
    const end = new Date(start.getTime() + durMin * 60000);

    const sk = `s${slot._id}`;
    const uk = `u${u._id}`;
    if (!isFree(sk, start, end) || !isFree(uk, start, end)) continue;
    take(sk, start, end);
    take(uk, start, end);

    const cancelled = Math.random() < 0.05;
    const h = start.getHours();
    const mult = PEAK.includes(h) ? 1.5 : h < 7 || h >= 21 ? 0.8 : 1;
    docs.push({
      user: u._id,
      slot: slot._id,
      vehicleNumber: p.plate,
      vehicleType: p.vt,
      startTime: start,
      checkInTime: cancelled ? undefined : start,
      checkOutTime: cancelled ? undefined : end,
      status: cancelled ? "cancelled" : "completed",
      fee: cancelled ? 0 : computeFee(p.vt, durMin / 60, mult),
      qrToken: crypto.randomBytes(16).toString("hex"),
    });
  }

  // A few live bookings so the slot grid already shows some occupied slots
  const shuffled = shuffle(slots);
  const liveSlots = shuffled.slice(0, 6);
  const maintenanceSlots = shuffled.slice(6, 8);
  const usedUsers = new Set();
  const occupiedIds = [];
  for (const slot of liveSlots) {
    const candidates = users.filter((u) => profile[u._id].vt === slot.vehicleType && !usedUsers.has(String(u._id)));
    if (!candidates.length) continue;
    const u = pick(candidates);
    usedUsers.add(String(u._id));
    const checkIn = new Date(Date.now() - rand(20, 150) * 60000);
    docs.push({
      user: u._id,
      slot: slot._id,
      vehicleNumber: profile[u._id].plate,
      vehicleType: slot.vehicleType,
      startTime: checkIn,
      checkInTime: checkIn,
      status: "checked_in",
      fee: 0,
      qrToken: crypto.randomBytes(16).toString("hex"),
    });
    occupiedIds.push(slot._id);
  }

  await Booking.insertMany(docs);
  await Slot.updateMany({ _id: { $in: occupiedIds } }, { status: "occupied" });
  await Slot.updateMany({ _id: { $in: maintenanceSlots.map((s) => s._id) } }, { status: "maintenance" });

  console.log(`Seeded: ${users.length + 1} users, ${slots.length} slots, ${docs.length} bookings`);
  console.log("Admin login: admin@orbit.io (or admin@parksmart.com) / admin123");
  console.log("User login:  rahul@example.com / password123");
  await mongoose.disconnect();
})().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
