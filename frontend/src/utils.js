export const fmtHour = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
export const fmtHourShort = (h) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;

export const money = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "—";

export const statusLabel = (s) => (s || "").replace("_", " ");

// Straight-line distance between two lat/lng points, in metres
export function haversine(a, b) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Compass direction from a to b, e.g. "north-east"
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
export function compassDirection(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}

export const fmtDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
export const fmtDuration = (s) => (s < 60 ? `${Math.max(1, Math.round(s))} sec` : `${Math.round(s / 60)} min`);

// Cleanly format vehicle registration number (e.g. KA01AB1234 -> KA 01 AB 1234)
export function formatPlate(str) {
  if (!str) return "—";
  const cleaned = str.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = cleaned.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})?(\d{1,4})?$/);
  if (m) {
    return [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ");
  }
  return cleaned;
}

// Live elapsed duration formatted as "1h 24m 10s"
export function formatElapsed(fromTime, toTime = new Date()) {
  if (!fromTime) return "0m";
  const ms = Math.max(0, new Date(toTime) - new Date(fromTime));
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
