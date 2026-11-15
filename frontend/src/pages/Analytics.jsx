import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  Filter,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";
import api, { errMsg } from "../api";
import { useToast } from "../components/Toast.jsx";
import { fmtHour, fmtHourShort, money } from "../utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function Heatmap({ data }) {
  const cells = new Map(data.map((d) => [`${d.dow}-${d.hour}`, d.count]));
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="heat-matrix-wrap">
      <div className="heat-grid">
        <div className="heat-row" style={{ marginBottom: 4 }}>
          <span />
          {HOURS.map((h) => (
            <span key={h} style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", fontFamily: "JetBrains Mono" }}>
              {h % 3 === 0 ? fmtHourShort(h) : ""}
            </span>
          ))}
        </div>
        {DAYS.map((d, i) => (
          <div className="heat-row" key={d}>
            <span className="heat-day-label">{d}</span>
            {HOURS.map((h) => {
              const c = cells.get(`${i + 1}-${h}`) || 0;
              const intensity = c ? 0.15 + (0.85 * c) / max : 0;
              return (
                <div
                  key={h}
                  className="heat-cell"
                  title={`${d} at ${fmtHour(h)}: ${c} historical booking${c === 1 ? "" : "s"}`}
                  style={
                    c > 0
                      ? {
                          background: `rgba(59, 130, 246, ${intensity})`,
                          boxShadow: c / max > 0.6 ? "0 0 8px rgba(59, 130, 246, 0.4)" : "none",
                          borderColor: c / max > 0.6 ? "rgba(96, 165, 250, 0.5)" : "var(--line)",
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)", marginTop: 16 }}>
        <span>Low Congestion</span>
        <div style={{ width: 120, height: 6, borderRadius: 9999, background: "linear-gradient(90deg, rgba(59,130,246,0.15), rgba(59,130,246,1))" }} />
        <span>Peak Congestion Surge</span>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "rgba(14, 21, 38, 0.95)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          padding: "10px 14px",
          borderRadius: "10px",
          color: "#fff",
          fontSize: "12px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4, color: "#94a3b8" }}>{label}</div>
        {payload.map((entry, idx) => (
          <div key={idx} style={{ color: entry.color, display: "flex", gap: 12, justifyContent: "space-between" }}>
            <span>{entry.name}:</span>
            <b>{entry.name.toLowerCase().includes("revenue") ? money(entry.value) : entry.value}</b>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const toast = useToast();
  const [filters, setFilters] = useState({ from: "", to: "", zone: "", vehicleType: "" });
  const [summary, setSummary] = useState(null);
  const [heat, setHeat] = useState([]);
  const [daily, setDaily] = useState([]);
  const [byZone, setByZone] = useState([]);
  const [demand, setDemand] = useState([]);
  const [zones, setZones] = useState([]);

  useEffect(() => {
    api.get("/slots")
      .then((r) => setZones([...new Set(r.data.map((s) => s.zone))].sort()))
      .catch(() => {});
    api.get("/ai/prediction")
      .then((r) =>
        setDemand(
          r.data.counts.map((c, h) => ({
            hour: fmtHourShort(h),
            bookings: c,
            trend: r.data.smoothed[h],
          }))
        )
      )
      .catch(() => {});
  }, []);

  const setFilter = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  const load = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => v && (params[k] = v));
    api.get("/analytics/summary", { params }).then((r) => setSummary(r.data)).catch((e) => toast(errMsg(e), "error"));
    api.get("/analytics/heatmap", { params }).then((r) => setHeat(r.data)).catch((e) => toast(errMsg(e), "error"));
    api.get("/analytics/revenue-daily", { params }).then((r) => setDaily(r.data)).catch((e) => toast(errMsg(e), "error"));
    api.get("/analytics/by-zone", { params }).then((r) => setByZone(r.data)).catch((e) => toast(errMsg(e), "error"));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Spatial Operations & Telemetry</h1>
          <p>Real-time campus occupancy telemetry, revenue attribution, and historical demand heatmaps.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-icon">
            <BarChart3 size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Total Volume</div>
            <div className="kpi-val">{summary ? summary.total.toLocaleString("en-IN") : "…"}</div>
            <div className="kpi-sub">Lifetime passes booked</div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--ok)", borderColor: "var(--ok-border)" }}>
            <CheckCircle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Completed Sessions</div>
            <div className="kpi-val" style={{ color: "var(--ok)" }}>
              {summary ? summary.completed.toLocaleString("en-IN") : "…"}
            </div>
            <div className="kpi-sub">Verified gate exits</div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-icon" style={{ background: "rgba(59, 130, 246, 0.12)", color: "var(--brand)", borderColor: "var(--brand-border)" }}>
            <Activity size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Active Occupants</div>
            <div className="kpi-val" style={{ color: "var(--brand)" }}>
              {summary ? summary.active : "…"}
            </div>
            <div className="kpi-sub">Vehicles parked now</div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "var(--warn)", borderColor: "var(--warn-border)" }}>
            <DollarSign size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Billed Tariff</div>
            <div className="kpi-val">{summary ? money(summary.revenue) : "…"}</div>
            <div className="kpi-sub">Dynamic tariff collection</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, marginRight: 4 }}>
            <Filter size={15} /> Telemetry Scope:
          </div>
          <input
            type="date"
            value={filters.from}
            onChange={setFilter("from")}
            title="From date"
            style={{ width: "auto" }}
          />
          <input
            type="date"
            value={filters.to}
            onChange={setFilter("to")}
            title="To date"
            style={{ width: "auto" }}
          />
          <select value={filters.zone} onChange={setFilter("zone")} style={{ width: "auto" }}>
            <option value="">All Zones</option>
            {zones.map((z) => (
              <option key={z} value={z}>Zone {z}</option>
            ))}
          </select>
          <select value={filters.vehicleType} onChange={setFilter("vehicleType")} style={{ width: "auto" }}>
            <option value="">All Vehicle Types</option>
            <option value="4-wheeler">4-Wheeler (Cars)</option>
            <option value="2-wheeler">2-Wheeler (Bikes)</option>
          </select>
        </div>

        {(filters.from || filters.to || filters.zone || filters.vehicleType) && (
          <button
            className="btn btn-sm"
            onClick={() => setFilters({ from: "", to: "", zone: "", vehicleType: "" })}
          >
            Reset Scope
          </button>
        )}
      </div>

      {/* Main Charts Section */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 24, marginBottom: 28 }}>
        {/* Revenue Growth Chart */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3>Daily Revenue Trajectory</h3>
              <p className="muted" style={{ fontSize: 12 }}>Cumulative tariff collection per operating day</p>
            </div>
            <span className="badge badge-completed">Revenue Stream</span>
          </div>
          <div style={{ height: 260, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Daily Revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Zone Utilization */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3>Zone Volume Distribution</h3>
              <p className="muted" style={{ fontSize: 12 }}>Parking demand density across wings</p>
            </div>
            <span className="badge badge-normal">Wing Density</span>
          </div>
          <div style={{ height: 260, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byZone}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="zone" tickFormatter={(z) => `Zone ${z}`} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="bookings" name="Bookings" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 24x7 Occupancy Heatmap */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 16 }}>
          <h3>24/7 Congestion Matrix</h3>
          <p className="muted" style={{ fontSize: 12 }}>
            Hourly booking concentration telemetry mapped across days of the week (Sun–Sat) and 24 hours of the day
          </p>
        </div>
        <Heatmap data={heat} />
      </div>

      {/* Hourly 24h Demand Curve */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h3>Smoothed Hourly Demand & Dynamic Surge Multiplier</h3>
            <p className="muted" style={{ fontSize: 12 }}>
              Circular moving average curve computing dynamic congestion tariffs in real-time
            </p>
          </div>
          <span className="badge badge-booked">Moving Avg Model</span>
        </div>
        <div style={{ height: 240, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={demand}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="bookings" name="Raw Hourly Volume" fill="var(--line-strong)" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="trend" name="Smoothed Traffic" stroke="#3b82f6" strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
