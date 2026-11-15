// Left-hand brand panel on the login / sign-up screens. The grid is a tiny decorative parking lot.
const LOT = [
  "on", "mid", "", "on", "",
  "", "on", "on", "", "mid",
  "mid", "", "on", "", "on",
  "on", "", "mid", "on", "",
];

export default function AuthHero() {
  return (
    <div className="auth-hero">
      <div className="brand">
        <div className="brand-mark">O</div>
        <div className="brand-text">
          <span className="brand-title" style={{ color: "#fff" }}>Orbit</span>
          <span className="brand-tag" style={{ color: "rgba(255,255,255,0.7)" }}>Autonomous Spatial Grid</span>
        </div>
      </div>
      <div>
        <h1>Dock into your bay before you reach the gate.</h1>
        <p>
          Precision spatial bay availability, autonomous QR verification, real-time demand surge forecasting, and OSRM trajectory telemetry.
        </p>
      </div>
      <div className="hero-grid" aria-hidden="true">
        {LOT.map((c, i) => (
          <span key={i} className={c} />
        ))}
      </div>
    </div>
  );
}
