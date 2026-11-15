require("dotenv").config();
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const User = require("./models/User");
const Booking = require("./models/Booking");
const { sweepExpiredBookings } = require("./routes/bookings");
const { initRealtime, loadSlots } = require("./utils/realtime");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || true, credentials: true },
});
initRealtime(io);

app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json());

let isDbConnected = false;
let dbErrorMsg = "";

app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/api/health") return next();
  if (!isDbConnected) {
    return res.status(503).json({
      message: dbErrorMsg || "Database is currently offline. Please whitelist your IP in MongoDB Atlas (Network Access -> Add 0.0.0.0/0).",
    });
  }
  next();
});

app.get("/", (req, res) => res.send("Orbit Autonomous Spatial Parking API running"));
app.get("/api/health", (req, res) => res.json({ ok: true, name: "Orbit", dbConnected: isDbConnected }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/slots", require("./routes/slots"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/analytics", require("./routes/analytics"));

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("unauthorized"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("role name");
    if (!user) return next(new Error("unauthorized"));
    socket.userId = String(user._id);
    socket.userRole = user.role;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", async (socket) => {
  socket.join(`user:${socket.userId}`);
  socket.join("slots");
  if (socket.userRole === "admin" || socket.userRole === "staff") socket.join("gate");
  try {
    socket.emit("slots:sync", await loadSlots());
  } catch (err) {
    console.error("Initial slot sync failed:", err.message);
  }
});

const PORT = process.env.PORT || 5000;

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error("Missing MONGO_URI or JWT_SECRET. Check your backend .env file.");
}

async function connectDb() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isDbConnected = true;
    dbErrorMsg = "";
    console.log("MongoDB connected successfully [Orbit Hub]");
    await Booking.syncIndexes().catch((err) => {
      console.error("Booking index sync failed (check for duplicate active bookings):", err.message);
    });

    setInterval(() => {
      sweepExpiredBookings().catch(() => {});
    }, 30000);
  } catch (err) {
    isDbConnected = false;
    dbErrorMsg = "Database connection failed. Ensure your current IP is whitelisted in MongoDB Atlas (Network Access -> Add 0.0.0.0/0).";
    console.error("MongoDB Atlas connection pending/failed: IP address likely not whitelisted in Atlas Network Access.");
    console.log("Will retry connecting in 10 seconds...");
    setTimeout(connectDb, 10000);
  }
}

server.listen(PORT, () => {
  console.log(`Orbit Server running on port ${PORT}`);
  connectDb();
});
