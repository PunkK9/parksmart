const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { sendVerificationEmail } = require("../utils/mailer");
const wrap = require("../utils/wrap");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
const clientUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

const sign = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

// Creates a fresh one-time token (stored hashed), saves the user, and emails the link.
async function sendVerification(user) {
  const raw = crypto.randomBytes(32).toString("hex");
  user.verifyTokenHash = sha(raw);
  user.verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  const link = `${clientUrl()}/verify-email?token=${raw}`;
  try {
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      link,
    });
    return { success: true, link };
  } catch (e) {
    console.error("Verification email failed:", e.message);
    return { success: false, link };
  }
}

// Sign up: creates an UNVERIFIED account and emails a verification link.
router.post("/register", wrap(async (req, res) => {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const role = ["student", "staff"].includes(req.body.role) ? req.body.role : "student";

  if (!name) return res.status(400).json({ message: "Enter your name" });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Enter a valid email address" });
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

  let user = await User.findOne({ email });
  const hashed = await bcrypt.hash(password, 10);

  if (user) {
    if (user.emailVerified)
      return res.status(409).json({ message: "That email is already registered. Log in instead." });
    // Unverified account signing up again: refresh details and resend the email.
    user.name = name;
    user.password = hashed;
    user.role = role;
  } else {
    user = new User({ name, email, password: hashed, role });
  }

  const { success: emailSent, link: devLink } = await sendVerification(user);
  res.status(201).json({
    emailSent,
    email,
    devLink: process.env.NODE_ENV !== "production" || !process.env.EMAIL_USER ? devLink : undefined,
    message: emailSent
      ? "Verification email sent. Check your inbox (and spam folder)."
      : "Account created, but the verification email couldn't be sent. Check backend terminal or Resend on the next screen.",
  });
}));

// Called by the page the email link opens.
router.post("/verify-email", wrap(async (req, res) => {
  const token = req.body.token || "";
  if (!token) return res.status(400).json({ message: "Missing verification token" });

  const user = await User.findOne({ verifyTokenHash: sha(token), verifyExpires: { $gt: new Date() } });
  if (!user)
    return res.status(400).json({ message: "This verification link is invalid or has expired." });

  user.emailVerified = true;
  user.verifyTokenHash = undefined;
  user.verifyExpires = undefined;
  await user.save();
  res.json({ message: "Email verified. You can log in now." });
}));

router.post("/resend-verification", wrap(async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const user = await User.findOne({ email });
  let emailSent = true;
  let devLink;
  if (user && !user.emailVerified) {
    const result = await sendVerification(user);
    emailSent = result.success;
    devLink = result.link;
  }
  // Same reply either way, so the endpoint can't be used to discover registered emails.
  res.json({
    emailSent,
    devLink: process.env.NODE_ENV !== "production" || !process.env.EMAIL_USER ? devLink : undefined,
    message: "If that account exists and isn't verified yet, a new email is on its way.",
  });
}));

router.post("/login", wrap(async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(req.body.password || "", user.password)))
    return res.status(401).json({ message: "Invalid email or password" });

  if (!user.emailVerified)
    return res.status(403).json({
      code: "EMAIL_NOT_VERIFIED",
      message: "Verify your email first. We sent a link to your inbox.",
    });

  res.json({ token: sign(user._id), user: publicUser(user) });
}));

router.get("/me", protect, (req, res) => res.json(publicUser(req.user)));

module.exports = router;
