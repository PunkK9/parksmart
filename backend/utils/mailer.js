const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = (process.env.EMAIL_PASS || "").replace(/\s/g, "");
  if (!user || !pass || user.includes("yourgmail")) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  }
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log("\n[DEV MAIL - Orbit Mailer]");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log(text, "\n");
    return;
  }
  await t.sendMail({ from: `"Orbit" <${process.env.EMAIL_USER}>`, to, subject, html, text });
}

async function sendVerificationEmail({ to, name, link }) {
  const text = `Hi ${name},\n\nWelcome to Orbit Smart Parking. Verify your email to activate your account:\n${link}\n\nThis link expires in 24 hours. If you didn't sign up, please ignore this email.`;
  const html = `
  <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;max-width:480px;margin:auto;padding:28px;background:#0b1120;color:#f8fafc;border:1px solid rgba(255,255,255,0.1);border-radius:16px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,#2563eb,#6366f1);border-radius:8px;display:grid;place-items:center;color:#fff;font-weight:bold;font-size:18px;">O</div>
      <span style="font-size:18px;font-weight:bold;letter-spacing:-0.02em;">Orbit</span>
    </div>
    <h2 style="margin:0 0 10px;color:#f8fafc">Verify your Orbit account</h2>
    <p style="color:#94a3b8;line-height:1.6">Hi ${name}, welcome to Orbit. Confirm your email address to start booking parking.</p>
    <p style="margin:28px 0">
      <a href="${link}" style="background:linear-gradient(135deg,#2563eb,#3b82f6);color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;box-shadow:0 4px 14px rgba(37,99,235,0.4)">Activate Account</a>
    </p>
    <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br><span style="color:#38bdf8">${link}</span></p>
    <p style="color:#475569;font-size:12px;margin-top:24px;border-top:1px solid rgba(255,255,255,0.08);padding-top:14px">This verification link expires in 24 hours.</p>
  </div>`;
  await sendMail({ to, subject: "Verify your Orbit account", html, text });
}

async function sendHoldReleased({ to, name, slotCode }) {
  const text = `Hi ${name},\n\nYour Orbit hold on bay ${slotCode} expired because check-in did not happen within 15 minutes. The bay is available again.\n\nYou can reserve another bay from the Orbit grid.`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:28px;background:#0b1120;color:#f8fafc;border-radius:16px">
    <h2 style="margin:0 0 10px">Hold released · Bay ${slotCode}</h2>
    <p style="color:#94a3b8;line-height:1.6">Hi ${name}, check-in did not happen within 15 minutes, so bay ${slotCode} is free again.</p>
  </div>`;
  await sendMail({ to, subject: `Orbit hold released · Bay ${slotCode}`, html, text });
}

module.exports = { sendVerificationEmail, sendHoldReleased };
