import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  Compass,
  Copy,
  Navigation,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import api, { errMsg } from "../api";
import { useToast } from "../components/Toast.jsx";
import RouteMap from "../components/RouteMap.jsx";
import { HOLD_MINUTES } from "../config";
import { getSocket } from "../socket";
import { fmtDateTime, formatElapsed, formatPlate, money, statusLabel } from "../utils";

function holdLeft(expiresAt, now) {
  const ms = new Date(expiresAt) - now;
  if (ms <= 0) return "releasing";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MyBookings() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [mapSlot, setMapSlot] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/bookings/mine");
      setItems(data);
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return undefined;
    const refresh = () => load();
    socket.on("booking:released", refresh);
    socket.on("slots:sync", refresh);
    return () => {
      socket.off("booking:released", refresh);
      socket.off("slots:sync", refresh);
    };
  }, [load]);

  // Live seconds ticker for elapsed parking chronometer
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const scan = async (b) => {
    setBusyId(b._id);
    try {
      const { data } = await api.post("/bookings/scan", { qrToken: b.qrToken });
      if (data.action === "checked_in") {
        toast(`Gate sensor activated! Checked in to Bay ${b.slot.code}`, "success");
      } else {
        toast(`Checked out successfully! Total tariff billed: ${money(data.booking.fee)}`, "success");
      }
      await load();
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (b) => {
    if (!window.confirm(`Cancel your reservation for Bay ${b.slot.code}?`)) return;
    setBusyId(b._id);
    try {
      await api.put(`/bookings/${b._id}/cancel`);
      toast("Reservation cancelled. Stalled bay released.", "info");
      await load();
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusyId(null);
    }
  };

  const copyToken = (token) => {
    navigator.clipboard.writeText(token);
    toast("Gate Access Token copied to clipboard!", "success");
  };

  const active = items.filter((b) => ["booked", "checked_in"].includes(b.status));
  const history = items.filter((b) => !["booked", "checked_in"].includes(b.status));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Orbit Digital Access Passes</h1>
          <p>Scan your spatial boarding pass at entrance and exit boom gate scanners.</p>
        </div>
      </div>

      {!loaded ? (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <div className="muted">Synchronizing parking wallet with campus ledger…</div>
        </div>
      ) : (
        <>
          {active.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "54px 24px", marginBottom: 36 }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 18px",
                  boxShadow: "var(--brand-glow)",
                }}
              >
                <QrCode size={30} />
              </div>
              <h3 style={{ fontSize: 19, marginBottom: 8 }}>No Active Passes</h3>
              <p className="muted" style={{ maxWidth: 400, margin: "0 auto 24px" }}>
                You do not have any active bay reservations. Select an available bay on the spatial grid to activate a pass.
              </p>
              <Link className="btn btn-primary" to="/">
                Explore Vacant Bays
              </Link>
            </div>
          ) : (
            active.map((b) => {
              const isCheckedIn = b.status === "checked_in";
              return (
                <div className="ticket-wrapper" key={b._id}>
                  <div className="boarding-pass">
                    {/* Pass Header */}
                    <div className="pass-header">
                      <div>
                        <span className={`badge ${isCheckedIn ? "badge-checked_in" : "badge-booked"}`}>
                          {isCheckedIn ? "● IN PARKED STATE" : "● READY FOR GATE ENTRY"}
                        </span>
                        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                          Orbit Terminal · Zone {b.slot.zone}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span className="muted" style={{ fontSize: 11, fontFamily: "JetBrains Mono" }}>
                          ID #{b.qrToken.slice(0, 8).toUpperCase()}
                        </span>
                        <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "JetBrains Mono", color: "var(--brand)" }}>
                          {b.slot.code}
                        </div>
                      </div>
                    </div>

                    {/* Pass Body */}
                    <div className="pass-body">
                      <div>
                        {/* Stamped Number Plate */}
                        <div style={{ marginBottom: 14 }}>
                          <span className="kpi-label">Registered Vehicle</span>
                          <div style={{ marginTop: 4 }}>
                            <div className="ind-plate">
                              <span className="ind-badge">IND</span>
                              {formatPlate(b.vehicleNumber)}
                            </div>
                          </div>
                        </div>

                        {/* Timing Telemetry */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div>
                            <span className="kpi-label">Reservation Timestamp</span>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>
                              {fmtDateTime(b.createdAt)}
                            </div>
                          </div>

                          {!isCheckedIn && b.expiresAt && (
                            <div>
                              <span className="kpi-label">Hold remaining</span>
                              <div style={{ marginTop: 4 }}>
                                <span className="chronometer-pill">
                                  <Clock size={13} /> {holdLeft(b.expiresAt, now)} · releases after {HOLD_MINUTES} min
                                </span>
                              </div>
                            </div>
                          )}

                          {isCheckedIn && (
                            <div>
                              <span className="kpi-label">Session Elapsed</span>
                              <div style={{ marginTop: 4 }}>
                                <span className="chronometer-pill">
                                  <Clock size={13} /> {formatElapsed(b.checkInTime, now)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* QR Access Code Box */}
                      <div className="pass-qr-box">
                        <QRCodeSVG value={b.qrToken} size={145} level="H" />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#000", marginTop: 8, letterSpacing: "0.08em" }}>
                          SCAN AT BOOM GATE
                        </span>
                      </div>
                    </div>

                    {/* Pass Footer Actions */}
                    <div className="pass-footer">
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="btn btn-sm" onClick={() => copyToken(b.qrToken)}>
                          <Copy size={13} /> Copy Token
                        </button>
                        <button className="btn btn-sm" onClick={() => setMapSlot(b.slot)}>
                          <Compass size={13} /> View GPS Path
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={busyId === b._id}
                          onClick={() => scan(b)}
                        >
                          <ScanLine size={14} />
                          {isCheckedIn ? "Simulate Gate Check-Out" : "Simulate Gate Check-In"}
                        </button>
                        {!isCheckedIn && (
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={busyId === b._id}
                            onClick={() => cancel(b)}
                          >
                            <Trash2 size={13} /> Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Historical Trips Section */}
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Parking History & Invoices</h2>
            {history.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 36, color: "var(--muted)" }}>
                Completed sessions and billing statements will be archived here.
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Bay</th>
                        <th>Vehicle Plate</th>
                        <th>Entry Time</th>
                        <th>Exit Time</th>
                        <th>Tariff Billed</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((b) => (
                        <tr key={b._id}>
                          <td>
                            <b style={{ fontFamily: "JetBrains Mono", fontSize: 15 }}>{b.slot.code}</b>{" "}
                            <span className="muted" style={{ fontSize: 12 }}>({b.slot.zone})</span>
                          </td>
                          <td>
                            <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700 }}>
                              {formatPlate(b.vehicleNumber)}
                            </span>
                          </td>
                          <td>{fmtDateTime(b.checkInTime || b.startTime)}</td>
                          <td>{fmtDateTime(b.checkOutTime)}</td>
                          <td>
                            <b style={{ color: b.fee > 0 ? "var(--ink)" : "var(--muted)" }}>
                              {b.status === "completed" ? money(b.fee) : "—"}
                            </b>
                          </td>
                          <td>
                            <span className={`badge badge-${b.status}`}>{statusLabel(b.status)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* GPS Route Modal */}
      {mapSlot && <RouteMap slot={mapSlot} onClose={() => setMapSlot(null)} />}
    </>
  );
}
