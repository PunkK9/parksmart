import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import api, { errMsg } from "../api";
import { money } from "../utils";

export default function BookingModal({ slot, defaultVehicle, onClose, onBooked }) {
  const [vehicle, setVehicle] = useState(defaultVehicle || "");
  const [fee, setFee] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/ai/fee", { params: { vehicleType: slot.vehicleType } })
      .then((r) => setFee(r.data))
      .catch(() => {});
  }, [slot.vehicleType]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/bookings", { slotId: slot._id, vehicleNumber: vehicle });
      onBooked(data);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <div>
            <h2>Confirm Bay {slot.code}</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              Zone {slot.zone} · {slot.vehicleType}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Spatial Summary Pod */}
        <div
          style={{
            background: "var(--surface-glass)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-sm)",
            padding: 16,
            marginBottom: 20,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div>
            <span className="kpi-label">Fee per hour</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginTop: 2 }}>
              {fee ? `${money(fee.perHour)}` : "…"}<span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>/hr</span>
            </div>
          </div>

          <div>
            <span className="kpi-label">How busy</span>
            <div style={{ marginTop: 2 }}>
              {fee ? (
                <span className={`badge badge-${fee.level}`}>
                  <Zap size={11} /> {fee.level} ({fee.multiplier}x)
                </span>
              ) : (
                "…"
              )}
            </div>
          </div>
        </div>

        {error && <div className="notice notice-error">{error}</div>}

        <div className="field">
          <label htmlFor="vehicle">Vehicle number</label>
          <input
            id="vehicle"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value.toUpperCase())}
            placeholder="e.g. KA 01 AB 1234"
            required
            autoFocus
            style={{ fontFamily: "JetBrains Mono", fontSize: 15, fontWeight: 700 }}
          />
        </div>

        <button className="btn btn-primary btn-block" disabled={busy} style={{ height: 44 }}>
          {busy ? <Loader2 size={18} className="spin" /> : "Book bay"}
        </button>

        <p className="muted" style={{ fontSize: 12, marginTop: 14, textAlign: "center" }}>
          You pay only for the time you stay. The fee is worked out when you scan out at the gate.
        </p>
      </form>
    </div>
  );
}
