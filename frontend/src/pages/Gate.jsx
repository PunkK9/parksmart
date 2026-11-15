import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, ScanLine, X } from "lucide-react";
import api, { errMsg } from "../api";
import { useToast } from "../components/Toast.jsx";
import { getSocket } from "../socket";
import { money, statusLabel } from "../utils";

const STATUS_DOT = {
  available: "var(--ok)",
  reserved: "var(--warn)",
  occupied: "var(--bad)",
  maintenance: "var(--idle)",
};

export default function Gate() {
  const toast = useToast();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraNote, setCameraNote] = useState("");
  const [result, setResult] = useState(null);
  const [slots, setSlots] = useState([]);

  const loadSlots = useCallback(async () => {
    try {
      const { data } = await api.get("/slots");
      setSlots(data);
    } catch (e) {
      toast(errMsg(e), "error");
    }
  }, [toast]);

  useEffect(() => {
    loadSlots();
    const socket = getSocket();
    if (!socket) return undefined;
    const onSync = (data) => setSlots(data);
    socket.on("slots:sync", onSync);
    return () => socket.off("slots:sync", onSync);
  }, [loadSlots]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const submitToken = async (raw) => {
    const qrToken = (raw || "").trim();
    if (!qrToken || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const { data } = await api.post("/bookings/scan", { qrToken });
      setResult({ ok: true, data });
      toast(data.action === "checked_in" ? "Checked in" : `Checked out · ${money(data.booking.fee)}`, "success");
      setToken("");
    } catch (e) {
      setResult({ ok: false, message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const startCamera = async () => {
    setCameraNote("");
    if (!navigator.mediaDevices?.getUserMedia || !("BarcodeDetector" in window)) {
      setCameraNote("This browser cannot read QR codes from the camera. Paste the token instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          requestAnimationFrame(tick);
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            stream.getTracks().forEach((t) => t.stop());
            setCameraOn(false);
            submitToken(codes[0].rawValue);
            return;
          }
        } catch {
          /* keep scanning */
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      setCameraNote("Camera permission was blocked. Paste the token instead.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraOn(false);
  };

  const counts = slots.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="gate-shell">
      <header className="gate-top">
        <div>
          <span className="brand-title">Orbit Gate</span>
          <p>Check vehicles in and out. The bay grid updates as soon as a scan lands.</p>
        </div>
        <Link className="btn btn-sm" to="/">Leave desk</Link>
      </header>

      <div className="gate-layout">
        <section className="gate-scan card">
          <h2>Scanner</h2>
          <div className="gate-video">
            {cameraOn ? (
              <video ref={videoRef} autoPlay muted playsInline />
            ) : (
              <div className="gate-video-idle">
                <ScanLine size={42} />
                <span>Point a booking QR at the camera, or paste the token.</span>
              </div>
            )}
          </div>
          <div className="gate-actions">
            {cameraOn ? (
              <button type="button" className="btn" onClick={stopCamera}><X size={16} /> Stop camera</button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={startCamera}><Camera size={16} /> Open camera</button>
            )}
          </div>
          {cameraNote && <p className="muted">{cameraNote}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitToken(token);
            }}
          >
            <label htmlFor="gate-token">Token</label>
            <input
              id="gate-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste QR token"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? "Reading…" : "Scan token"}
            </button>
          </form>
          {result && (
            <div className={`notice ${result.ok ? "notice-ok" : "notice-error"}`}>
              {result.ok
                ? `${result.data.action === "checked_in" ? "Checked in" : "Checked out"} · Bay ${result.data.booking.slot.code} · ${result.data.booking.vehicleNumber}${result.data.action === "checked_out" ? ` · ${money(result.data.booking.fee)}` : ""}`
                : result.message}
            </div>
          )}
        </section>

        <section className="gate-board">
          <div className="gate-kpis">
            <span>Open {counts.available || 0}</span>
            <span>Held {counts.reserved || 0}</span>
            <span>In bay {counts.occupied || 0}</span>
            <span>Closed {counts.maintenance || 0}</span>
          </div>
          <div className="gate-slots">
            {slots.map((s) => (
              <div key={s._id} className="gate-slot" title={statusLabel(s.status)}>
                <i style={{ background: STATUS_DOT[s.status] || "var(--idle)" }} />
                <b>{s.code}</b>
                <small>{s.zone}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
