import { useCallback, useEffect, useState } from "react";
import { Copy, Plus, ScanLine, ShieldAlert, Trash2, Wrench } from "lucide-react";
import api, { errMsg } from "../api";
import { useToast } from "../components/Toast.jsx";
import { fmtDateTime, money, statusLabel } from "../utils";

function SlotsTab() {
  const toast = useToast();
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ code: "", zone: "", vehicleType: "4-wheeler", lat: "", lng: "" });

  const load = useCallback(() => api.get("/slots").then((r) => setSlots(r.data)).catch((e) => toast(errMsg(e), "error")), [toast]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    try {
      const body = {
        ...form,
        lat: form.lat === "" ? undefined : Number(form.lat),
        lng: form.lng === "" ? undefined : Number(form.lng),
      };
      await api.post("/slots", body);
      toast(`Bay ${form.code.toUpperCase()} added`, "success");
      setForm({ ...form, code: "", lat: "", lng: "" });
      load();
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  const setStatus = async (s, status) => {
    try {
      await api.put(`/slots/${s._id}`, { status });
      toast(`Bay ${s.code} set to ${status}`, "info");
      load();
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete parking bay ${s.code}?`)) return;
    try {
      await api.delete(`/slots/${s._id}`);
      toast(`Bay ${s.code} deleted`, "info");
      load();
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  return (
    <>
      <form className="card" onSubmit={add} style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Add a bay</h3>
        <div className="filters">
          <div>
            <label htmlFor="code">Bay Code</label>
            <input id="code" value={form.code} onChange={set("code")} placeholder="e.g. A11" required />
          </div>
          <div>
            <label htmlFor="zone">Zone</label>
            <input id="zone" value={form.zone} onChange={set("zone")} placeholder="e.g. A" required />
          </div>
          <div>
            <label htmlFor="vtype">Vehicle type</label>
            <select id="vtype" value={form.vehicleType} onChange={set("vehicleType")}>
              <option value="4-wheeler">Car</option>
              <option value="2-wheeler">Bike</option>
            </select>
          </div>
          <div>
            <label htmlFor="lat">Latitude</label>
            <input id="lat" type="number" step="any" value={form.lat} onChange={set("lat")} placeholder="13.0295" />
          </div>
          <div>
            <label htmlFor="lng">Longitude</label>
            <input id="lng" type="number" step="any" value={form.lng} onChange={set("lng")} placeholder="77.5642" />
          </div>
          <button className="btn btn-primary">
            <Plus size={15} /> Add Bay
          </button>
        </div>
      </form>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bay Code</th>
                <th>Zone</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th>Map location</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s._id}>
                  <td>
                    <b style={{ fontFamily: "JetBrains Mono", fontSize: 15 }}>{s.code}</b>
                  </td>
                  <td>Zone {s.zone}</td>
                  <td>{s.vehicleType}</td>
                  <td>
                    <span className={`badge badge-${s.status}`}>{s.status}</span>
                  </td>
                  <td>
                    <span className="muted" style={{ fontFamily: "JetBrains Mono", fontSize: 12 }}>
                      {typeof s.lat === "number" ? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}` : "—"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      {s.status === "available" && (
                        <button className="btn btn-sm" onClick={() => setStatus(s, "maintenance")}>
                          <Wrench size={13} /> Close Bay
                        </button>
                      )}
                      {s.status === "maintenance" && (
                        <button className="btn btn-sm" onClick={() => setStatus(s, "available")}>
                          Reopen Bay
                        </button>
                      )}
                      {["available", "maintenance"].includes(s.status) && (
                        <button className="btn btn-sm btn-danger" aria-label={`Delete ${s.code}`} onClick={() => remove(s)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function BookingsTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.get("/bookings", { params: status ? { status } : {} })
      .then((r) => setRows(r.data))
      .catch((e) => toast(errMsg(e), "error"));
  }, [status, toast]);

  const copy = (t) => {
    navigator.clipboard?.writeText(t);
    toast("Pass code copied. Paste it in the Gate scan tab.", "success");
  };

  return (
    <>
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter" style={{ width: "auto" }}>
          <option value="">All statuses</option>
          <option value="booked">Booked (not arrived)</option>
          <option value="checked_in">Checked in</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="muted" style={{ fontSize: 13 }}>Latest 200 bookings</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Bay</th>
                <th>Plate</th>
                <th>Start Time</th>
                <th>Fee</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Pass code</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b._id}>
                  <td>
                    <b>{b.user?.name || "—"}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{b.user?.email}</div>
                  </td>
                  <td>
                    <b style={{ fontFamily: "JetBrains Mono" }}>{b.slot?.code}</b>
                  </td>
                  <td>
                    <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700 }}>{b.vehicleNumber}</span>
                  </td>
                  <td>{fmtDateTime(b.startTime)}</td>
                  <td>
                    <b style={{ color: b.fee > 0 ? "var(--ink)" : "var(--muted)" }}>
                      {b.status === "completed" ? money(b.fee) : "—"}
                    </b>
                  </td>
                  <td>
                    <span className={`badge badge-${b.status}`}>{statusLabel(b.status)}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {["booked", "checked_in"].includes(b.status) && (
                      <button className="btn btn-sm" onClick={() => copy(b.qrToken)}>
                        <Copy size={13} /> Copy
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function GateTab() {
  const toast = useToast();
  const [token, setToken] = useState("");
  const [result, setResult] = useState(null);

  const scan = async (e) => {
    e.preventDefault();
    setResult(null);
    try {
      const { data } = await api.post("/bookings/scan", { qrToken: token });
      setResult({ ok: true, data });
      toast(data.action === "checked_in" ? "Checked in" : `Checked out. Fee: ${money(data.booking.fee)}`, "success");
      setToken("");
    } catch (err) {
      setResult({ ok: false, message: errMsg(err) });
    }
  };

  return (
    <div className="card" style={{ maxWidth: 540 }}>
      <h3 style={{ marginBottom: 6 }}>Gate scan</h3>
      <p className="muted" style={{ marginBottom: 18, fontSize: 13 }}>
        Works like the QR scanner at the gate. The first scan checks the vehicle in; the second checks it out and works out the fee.
      </p>
      <form onSubmit={scan}>
        <div className="field">
          <label htmlFor="tok">Pass code</label>
          <input
            id="tok"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste the pass code"
            required
            style={{ fontFamily: "JetBrains Mono" }}
          />
        </div>
        <button className="btn btn-primary">
          <ScanLine size={16} /> Scan
        </button>
      </form>
      {result && (
        <div className={`notice ${result.ok ? "notice-ok" : "notice-error"}`} style={{ marginTop: 18, marginBottom: 0 }}>
          {result.ok
            ? `${result.data.action === "checked_in" ? "✓ Checked in" : "✓ Checked out"}: Bay ${result.data.booking.slot.code}, ${result.data.booking.vehicleNumber}${result.data.action === "checked_out" ? ` · Fee Billed: ${money(result.data.booking.fee)}` : ""}`
            : result.message}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("slots");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Manage Bays</h1>
          <p>Add or close bays, see every booking, and test the gate scanner.</p>
        </div>
      </div>
      <div className="tabs">
        {[["slots", "Bays"], ["bookings", "Bookings"], ["gate", "Gate scan"]].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "slots" && <SlotsTab />}
      {tab === "bookings" && <BookingsTab />}
      {tab === "gate" && <GateTab />}
    </>
  );
}
