import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bike,
  Car,
  Clock,
  Compass,
  Layers,
  LayoutGrid,
  Map as MapIcon,
  Navigation,
  Satellite,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { Circle, MapContainer, Marker, Popup } from "react-leaflet";
import L from "../leafletGlobal";
import api, { errMsg } from "../api";
import { useToast } from "../components/Toast.jsx";
import BookingModal from "../components/BookingModal.jsx";
import RouteMap from "../components/RouteMap.jsx";
import SpatialTileLayer from "../components/SpatialTileLayer.jsx";
import { ENTRANCE, FACILITY_NAME, hasMapboxToken } from "../config";
import { getSocket } from "../socket";
import { fmtDistance, fmtHour, money } from "../utils";

const STATUS_CONFIG = {
  available: { label: "Vacant", cls: "stall-available", badgeCls: "badge-available", dot: "var(--ok)" },
  reserved: { label: "Reserved", cls: "stall-reserved", badgeCls: "badge-occupied", dot: "var(--warn)" },
  occupied: { label: "Occupied", cls: "stall-occupied", badgeCls: "badge-maintenance", dot: "var(--bad)" },
  maintenance: { label: "Closed", cls: "stall-maintenance", badgeCls: "badge-normal", dot: "var(--idle)" },
};

const mapPin = (status, code) =>
  L.divIcon({
    className: "",
    html: `
      <div style="
        width: 34px; height: 34px; border-radius: 50%;
        background: ${status === 'available' ? '#10b981' : status === 'reserved' ? '#f59e0b' : '#ef4444'};
        color: #ffffff; font-weight: 800; font-size: 11px;
        display: grid; place-items: center; border: 2.5px solid rgba(255,255,255,0.9);
        box-shadow: 0 8px 20px rgba(0,0,0,0.5);
        font-family: 'JetBrains Mono', monospace;
      ">
        ${code}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

export default function Book() {
  const toast = useToast();
  const nav = useNavigate();
  const [slots, setSlots] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [zone, setZone] = useState("all");
  const [vt, setVt] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("map");
  const [mapLayer, setMapLayer] = useState("satellite");
  const [mapStatus, setMapStatus] = useState("");
  const [showHeat, setShowHeat] = useState(true);
  const [live, setLive] = useState(false);
  const [recs, setRecs] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [pred, setPred] = useState(null);
  const [fee, setFee] = useState(null);
  const [fav, setFav] = useState(null);
  const [lastVehicle, setLastVehicle] = useState("");
  const [selected, setSelected] = useState(null);
  const [previewRouteSlot, setPreviewRouteSlot] = useState(null);

  const loadSlots = useCallback(async () => {
    try {
      const { data } = await api.get("/slots");
      setSlots(data);
      setLoaded(true);
    } catch (e) {
      toast(errMsg(e), "error");
    }
  }, [toast]);

  useEffect(() => {
    loadSlots();
    const socket = getSocket();
    if (!socket) return undefined;
    const onSync = (data) => {
      setSlots(data);
      setLoaded(true);
      setLive(true);
    };
    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    socket.on("slots:sync", onSync);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setLive(socket.connected);
    return () => {
      socket.off("slots:sync", onSync);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [loadSlots]);

  const recType = vt === "2-wheeler" ? "2-wheeler" : "4-wheeler";

  useEffect(() => {
    api.get("/ai/prediction").then((r) => setPred(r.data)).catch(() => {});
    api.get("/ai/fee", { params: { vehicleType: recType } }).then((r) => setFee(r.data)).catch(() => {});
    api.get("/ai/favorite-slot").then((r) => setFav(r.data)).catch(() => {});
    api.get("/ai/recommend", { params: { vehicleType: recType } }).then((r) => setRecs(r.data)).catch(() => {});
    api.get("/ai/forecast").then((r) => setForecast(r.data)).catch(() => {});
    api.get("/bookings/mine").then((r) => setLastVehicle(r.data[0]?.vehicleNumber || "")).catch(() => {});
  }, [recType]);

  const zones = useMemo(() => [...new Set(slots.map((s) => s.zone))].sort(), [slots]);

  const visible = useMemo(() => {
    return slots.filter((s) => {
      const matchZone = zone === "all" || s.zone === zone;
      const matchVt = vt === "all" || s.vehicleType === vt;
      const matchSearch =
        !search ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        s.zone.toLowerCase().includes(search.toLowerCase());
      return matchZone && matchVt && matchSearch;
    });
  }, [slots, zone, vt, search]);

  const grouped = useMemo(() => {
    const g = {};
    visible.forEach((s) => (g[s.zone] = g[s.zone] || []).push(s));
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const counts = useMemo(() => {
    const c = { available: 0, reserved: 0, occupied: 0, maintenance: 0 };
    slots.forEach((s) => (c[s.status] = (c[s.status] || 0) + 1));
    return c;
  }, [slots]);

  const forecastByZone = useMemo(() => {
    const map = {};
    (forecast?.zones || []).forEach((z) => {
      map[z.zone] = z;
    });
    return map;
  }, [forecast]);

  const occupancyPct = useMemo(() => {
    if (!slots.length) return 0;
    const taken = counts.reserved + counts.occupied;
    return Math.round((taken / slots.length) * 100);
  }, [slots, counts]);

  const booked = (b) => {
    setSelected(null);
    toast(`Bay ${b.slot.code} activated in Orbit! Digital Pass ready.`, "success");
    nav("/bookings");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Orbit Spatial Bay Matrix</h1>
          <p>
            {FACILITY_NAME} · {live ? "Live bay telemetry" : "Connecting live telemetry…"}
          </p>
        </div>

        {/* View Switcher */}
        <div className="segment-ctrl">
          <button
            type="button"
            className={`segment-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid size={14} /> 3D Bay Matrix
          </button>
          <button
            type="button"
            className={`segment-btn ${viewMode === "map" ? "active" : ""}`}
            onClick={() => setViewMode("map")}
          >
            <MapIcon size={14} /> Spatial Map
          </button>
        </div>
      </div>

      {/* KPI Cards & AI Intelligence */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--ok)", borderColor: "var(--ok-border)" }}>
            <Clock size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Optimal Arrival</div>
            <div className="kpi-val" style={{ fontSize: 18 }}>
              {pred?.hasData ? fmtHour(pred.bestHours[0]) : "Analyzing…"}
            </div>
            <div className="kpi-sub">Lowest congestion window</div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-icon" style={{ background: "rgba(244, 63, 94, 0.12)", color: "var(--bad)", borderColor: "var(--bad-border)" }}>
            <TrendingUp size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Surge Traffic</div>
            <div className="kpi-val" style={{ fontSize: 18 }}>
              {pred?.hasData && pred.peakHours?.length ? `${fmtHour(pred.peakHours[0])}` : "Nominal"}
            </div>
            <div className="kpi-sub">Dynamic surge multiplier</div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-icon">
            <Wallet size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Dynamic Tariff</div>
            <div className="kpi-val">
              {fee ? `${money(fee.perHour)}` : "…"}<span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)" }}>/hr</span>
            </div>
            <div className="kpi-sub">
              {fee && (
                <span className={`badge badge-${fee.level}`}>
                  <Zap size={11} /> {fee.level} ({fee.multiplier}x)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "var(--warn)", borderColor: "var(--warn-border)" }}>
            <Star size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Orbit Favorite</div>
            <div className="kpi-val">
              {fav ? fav.slot.code : "Bay A1"}
            </div>
            <div className="kpi-sub">
              {fav ? `${fav.count} previous sessions` : "Calibrating preferences"}
            </div>
          </div>
        </div>
      </div>

      {/* Facility Live Capacity Meter */}
      <div className="card" style={{ marginBottom: 28, padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color="var(--brand)" /> Autonomous Facility Capacity
          </span>
          <span style={{ fontWeight: 800, fontSize: 14, color: occupancyPct > 80 ? "var(--bad)" : "var(--brand)" }}>
            {occupancyPct}% Occupancy ({counts.reserved + counts.occupied} of {slots.length} bays)
          </span>
        </div>
        <div style={{ height: 8, background: "var(--surface-glass)", borderRadius: 9999, overflow: "hidden", border: "1px solid var(--line)" }}>
          <div
            style={{
              height: "100%",
              width: `${occupancyPct}%`,
              background:
                occupancyPct > 85
                  ? "linear-gradient(90deg, #f59e0b, #f43f5e)"
                  : "var(--brand-gradient)",
              borderRadius: 9999,
              transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: "0 0 12px rgba(59, 130, 246, 0.5)",
            }}
          />
        </div>
      </div>

      {forecast?.headline && (
        <div className="forecast-strip">
          <Sparkles size={16} />
          <div>
            <strong>{forecast.headline}</strong>
            <span>
              {forecast.zones.map((z) => `Zone ${z.zone} ${z.nowPct}% → ${z.predictedPct}%`).join(" · ")}
            </span>
          </div>
        </div>
      )}

      <section className="rec-panel">
        <div className="rec-head">
          <h2>Best for you</h2>
          <span className="muted">{recType === "2-wheeler" ? "Bike bays" : "Car bays"} · history, walk, and how full the zone is</span>
        </div>
        {!recs ? (
          <p className="muted">Scoring open bays…</p>
        ) : recs.picks.length === 0 ? (
          <p className="muted">No open {recType} bays right now.</p>
        ) : (
          <div className="rec-grid">
            {recs.picks.map((pick, i) => (
              <button key={pick.slot._id} type="button" className="rec-card" onClick={() => setSelected(pick.slot)}>
                <div className="rec-rank">{i === 0 ? "Best" : `#${i + 1}`}</div>
                <div>
                  <strong>{pick.slot.code}</strong>
                  <span>Zone {pick.slot.zone}</span>
                </div>
                <p>{pick.reasons.slice(0, 2).join(" · ")}</p>
                {pick.distanceM != null && <em>{fmtDistance(pick.distanceM)}</em>}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Spatial Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            className={`btn btn-sm ${zone === "all" ? "btn-primary" : ""}`}
            onClick={() => setZone("all")}
          >
            All Zones
          </button>
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              className={`btn btn-sm ${zone === z ? "btn-primary" : ""}`}
              onClick={() => setZone(z)}
            >
              Zone {z}
            </button>
          ))}
        </div>

        <div className="toolbar-group">
          <select
            value={vt}
            onChange={(e) => setVt(e.target.value)}
            style={{ width: "auto", minWidth: 170 }}
            aria-label="Vehicle type filter"
          >
            <option value="all">All Vehicles (All Types)</option>
            <option value="4-wheeler">4-Wheelers (Cars)</option>
            <option value="2-wheeler">2-Wheelers (Bikes)</option>
          </select>

          <div className="search-input-wrap">
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bay (e.g. A3)…"
            />
          </div>
        </div>
      </div>

      {/* View Mode 1: Interactive Spatial Map */}
      {viewMode === "map" && (
        <div className="card" style={{ padding: 14, marginBottom: 28 }}>
          <div style={{ padding: "8px 12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 16 }}>Live Spatial Campus Map</h3>
              <p className="muted" style={{ fontSize: 13 }}>Click on any vacant beacon to book or inspect its trajectory.</p>
            </div>

            {/* Map Layer Switcher */}
            <div className="toolbar-group">
              <div className="segment-ctrl">
                <button
                  type="button"
                  className={`segment-btn ${mapLayer === "satellite" ? "active" : ""}`}
                  onClick={() => setMapLayer("satellite")}
                >
                  <Satellite size={12} /> Satellite
                </button>
                <button
                  type="button"
                  className={`segment-btn ${mapLayer === "streets" ? "active" : ""}`}
                  onClick={() => setMapLayer("streets")}
                >
                  <Layers size={12} /> Streets
                </button>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${showHeat ? "btn-primary" : ""}`}
                onClick={() => setShowHeat((v) => !v)}
              >
                Heat
              </button>
            </div>
          </div>

          <div className="spatial-map-wrap" style={{ height: "min(68vh, 640px)" }}>
            <div className="map-status-pill">
              {mapStatus || "Map"}
              {!hasMapboxToken() && mapLayer === "satellite" ? " · add VITE_MAPBOX_TOKEN for imagery" : ""}
              {live ? " · live" : ""}
            </div>
            <MapContainer
              center={[13.0305, 77.5646]}
              zoom={18}
              style={{ height: "100%", width: "100%" }}
            >
              <SpatialTileLayer mode={mapLayer} onStatus={setMapStatus} />

              <Marker
                position={[ENTRANCE.lat, ENTRANCE.lng]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="background:var(--brand-gradient); color:#fff; font-weight:800; font-size:11px; padding:4px 10px; border-radius:9999px; border:2px solid #fff; box-shadow:0 6px 16px rgba(0,0,0,0.5); white-space:nowrap; font-family:'Plus Jakarta Sans',sans-serif;">${ENTRANCE.name}</div>`,
                  iconAnchor: [48, 16],
                })}
              />

              {showHeat &&
                visible
                  .filter((s) => typeof s.lat === "number")
                  .map((s) => {
                    const pct = forecastByZone[s.zone]?.predictedPct ?? 0;
                    const color = pct >= 80 ? "#f43f5e" : pct >= 55 ? "#f59e0b" : "#10b981";
                    return (
                      <Circle
                        key={`heat-${s._id}`}
                        center={[s.lat, s.lng]}
                        radius={14}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.28, weight: 0 }}
                      />
                    );
                  })}

              {visible.filter((s) => typeof s.lat === "number" && typeof s.lng === "number").map((s) => (
                <Marker
                  key={s._id}
                  position={[s.lat, s.lng]}
                  icon={mapPin(s.status, s.code)}
                >
                  <Popup>
                    <div style={{ padding: 6, textAlign: "center", minWidth: 150 }}>
                      <h4 style={{ margin: "0 0 4px", fontSize: 15 }}>Bay {s.code}</h4>
                      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>
                        Zone {s.zone} · {s.vehicleType}
                      </p>
                      <div style={{ marginBottom: 12 }}>
                        <span className={`badge ${STATUS_CONFIG[s.status]?.badgeCls}`}>
                          {STATUS_CONFIG[s.status]?.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {s.status === "available" && (
                          <button
                            className="btn btn-primary btn-sm btn-block"
                            onClick={() => setSelected(s)}
                          >
                            Reserve Bay {s.code}
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-block"
                          onClick={() => setPreviewRouteSlot(s)}
                        >
                          <Compass size={12} /> View GPS Path
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* View Mode 2: 3D Architectural Bay Stalls */}
      {viewMode === "grid" && (
        !loaded ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div className="muted">Synchronizing spatial telemetry with parking hardware…</div>
          </div>
        ) : grouped.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <p className="muted">No parking bays match the current filter criteria.</p>
          </div>
        ) : (
          grouped.map(([z, list]) => {
            const availableCount = list.filter((s) => s.status === "available").length;
            const isBikeZone = list[0]?.vehicleType === "2-wheeler";
            return (
              <div className="zone-block" key={z}>
                <div className="zone-header">
                  <div className="zone-badge">
                    <span className="zone-chip">Zone {z}</span>
                    <span>{isBikeZone ? "Covered 2-Wheeler Pavilion" : "Dedicated 4-Wheeler Bays"}</span>
                  </div>
                  <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
                    <b style={{ color: availableCount > 0 ? "var(--ok)" : "var(--bad)" }}>{availableCount}</b> of {list.length} vacant
                  </span>
                </div>

                <div className="slots-grid">
                  {list.map((s) => {
                    const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.available;
                    const isAvail = s.status === "available";
                    return (
                      <div
                        key={s._id}
                        className={`stall ${cfg.cls}`}
                        onClick={() => {
                          if (isAvail) setSelected(s);
                          else setPreviewRouteSlot(s);
                        }}
                      >
                        <div className="stall-top">
                          <span className="stall-code">{s.code}</span>
                          <span className="stall-diode" style={{ background: cfg.dot, color: cfg.dot }} />
                        </div>

                        <div className="stall-mid">
                          {s.vehicleType === "2-wheeler" ? <Bike size={24} /> : <Car size={24} />}
                        </div>

                        <div className="stall-bottom">
                          <span className="stall-status-text" style={{ color: cfg.dot }}>
                            {cfg.label}
                          </span>
                          <span className="stall-rate">
                            {fee ? money(fee.perHour) : "₹30"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )
      )}

      {/* Booking Dialog Modal */}
      {selected && (
        <BookingModal
          slot={selected}
          defaultVehicle={lastVehicle}
          onClose={() => setSelected(null)}
          onBooked={booked}
        />
      )}

      {/* GPS Route Preview Modal */}
      {previewRouteSlot && (
        <RouteMap
          slot={previewRouteSlot}
          onClose={() => setPreviewRouteSlot(null)}
        />
      )}
    </>
  );
}
