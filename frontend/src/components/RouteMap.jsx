import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, useMap } from "react-leaflet";
import { Compass, CornerUpLeft, CornerUpRight, Layers, MapPin, Navigation, Satellite, X } from "lucide-react";
import L from "../leafletGlobal";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import { ENTRANCE } from "../config";
import { fmtDistance, fmtDuration, haversine } from "../utils";
import SpatialTileLayer from "./SpatialTileLayer.jsx";

// Custom high-DPI Leaflet radar beacon marker
const createPin = (cls, label, subtitle = "") =>
  L.divIcon({
    className: "",
    html: `
      <div class="pin ${cls} pin-pulse">
        <span>${label}</span>
      </div>
      ${subtitle ? `<div style="position:absolute; top:40px; left:50%; transform:translateX(-50%); background:rgba(7,10,18,0.9); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); color:#fff; font-size:10px; font-weight:800; padding:2px 8px; border-radius:6px; white-space:nowrap; box-shadow:0 6px 16px rgba(0,0,0,0.6); font-family:'JetBrains Mono',monospace;">${subtitle}</div>` : ""}
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

function Routing({ from, to, onResult }) {
  const map = useMap();

  useEffect(() => {
    const control = L.Routing.control({
      waypoints: [L.latLng(from.lat, from.lng), L.latLng(to.lat, to.lng)],
      router: L.Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1",
        profile: "driving",
      }),
      show: false,
      addWaypoints: false,
      draggableWaypoints: false,
      routeWhileDragging: false,
      fitSelectedRoutes: true,
      createMarker: () => null,
      lineOptions: {
        styles: [
          { color: "#0f172a", weight: 10, opacity: 0.8 },
          { color: "#2563eb", weight: 6, opacity: 0.95 },
          { color: "#38bdf8", weight: 2.5, opacity: 1 },
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
    }).addTo(map);

    control.on("routesfound", (e) => {
      const r = e.routes[0];
      const s = r.summary;
      onResult({
        ok: true,
        distance: s.totalDistance,
        time: s.totalTime,
        instructions: r.instructions || [],
      });
    });

    control.on("routingerror", () => onResult({ ok: false }));

    return () => {
      try {
        map.removeControl(control);
      } catch {
        /* detached */
      }
    };
  }, [map, from.lat, from.lng, to.lat, to.lng, onResult]);

  return null;
}

function FitBoth({ from, to }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([[from.lat, from.lng], [to.lat, to.lng]], {
      padding: [60, 60],
      maxZoom: 19,
    });
  }, [map, from.lat, from.lng, to.lat, to.lng]);
  return null;
}

export default function RouteMap({ slot, onClose }) {
  const [route, setRoute] = useState(null);
  const [layer, setLayer] = useState("satellite"); // Default to high-res Satellite
  const slotPos = useMemo(() => ({ lat: slot.lat, lng: slot.lng }), [slot.lat, slot.lng]);
  const hasCoords = typeof slot.lat === "number" && typeof slot.lng === "number";
  const straight = hasCoords ? haversine(ENTRANCE, slotPos) : null;

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900, width: "95%" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2>Orbit Spatial Trajectory · Bay {slot.code}</h2>
              <span className="badge badge-completed">
                Zone {slot.zone} · {slot.vehicleType}
              </span>
            </div>
            <p className="muted" style={{ marginTop: 4 }}>
              Precision autonomous navigation from {ENTRANCE.name} to Bay {slot.code}
            </p>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {hasCoords ? (
          <>
            <div className="spatial-map-wrap" style={{ height: 430 }}>
              {/* Floating Spatial HUD */}
              <div className="map-hud-top">
                <div className="map-hud-pill">
                  <Navigation size={13} style={{ color: "var(--brand)" }} />
                  <span>{ENTRANCE.name} → Bay {slot.code}</span>
                </div>

                {/* Spatial Map Layer Switcher */}
                <div className="segment-ctrl">
                  <button
                    type="button"
                    className={`segment-btn ${layer === "satellite" ? "active" : ""}`}
                    onClick={() => setLayer("satellite")}
                  >
                    <Satellite size={12} /> Mapbox Satellite
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${layer === "streets" ? "active" : ""}`}
                    onClick={() => setLayer("streets")}
                  >
                    <Layers size={12} /> Vector HUD
                  </button>
                </div>
              </div>

              <MapContainer
                center={[slot.lat, slot.lng]}
                zoom={18}
                style={{ height: "100%", width: "100%" }}
              >
                <SpatialTileLayer mode={layer} />

                <Marker position={[ENTRANCE.lat, ENTRANCE.lng]} icon={createPin("pin-entrance", "GATE", "Orbit Gateway")} />
                <Marker position={[slot.lat, slot.lng]} icon={createPin("pin-destination", slot.code, `Bay ${slot.code}`)} />
                <FitBoth from={ENTRANCE} to={slotPos} />
                <Routing from={ENTRANCE} to={slotPos} onResult={setRoute} />
              </MapContainer>
            </div>

            {/* Spatial Metrics Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 18 }}>
              <div className="card" style={{ padding: "16px 18px" }}>
                <span className="kpi-label">Direct Euclidean Radius</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>
                  {fmtDistance(straight)}
                </div>
                <span className="muted" style={{ fontSize: 11 }}>Straight-line vector</span>
              </div>
              <div className="card" style={{ padding: "16px 18px" }}>
                <span className="kpi-label">Driving Lane Distance</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--brand)", marginTop: 4 }}>
                  {route?.ok ? fmtDistance(route.distance) : route ? "Direct Waypoint" : "Calculating…"}
                </div>
                <span className="muted" style={{ fontSize: 11 }}>Campus lane network</span>
              </div>
              <div className="card" style={{ padding: "16px 18px" }}>
                <span className="kpi-label">Estimated Transit Time</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ok)", marginTop: 4 }}>
                  {route?.ok ? fmtDuration(route.time) : route ? "< 1 min" : "Calculating…"}
                </div>
                <span className="muted" style={{ fontSize: 11 }}>At low-speed perimeter speed</span>
              </div>
            </div>

            {/* Turn-by-Turn Instruction Drawer */}
            {route?.ok && route.instructions?.length > 0 && (
              <div className="route-drawer">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14 }}>Turn-by-Turn Maneuver Sequence</h3>
                  <span className="badge badge-normal">{route.instructions.length} steps</span>
                </div>
                <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {route.instructions.map((step, idx) => (
                    <div key={idx} className="instruction-item">
                      <div style={{ color: "var(--brand)", marginTop: 2 }}>
                        {step.type?.toLowerCase().includes("left") ? (
                          <CornerUpLeft size={16} />
                        ) : step.type?.toLowerCase().includes("right") ? (
                          <CornerUpRight size={16} />
                        ) : (
                          <Compass size={16} />
                        )}
                      </div>
                      <div style={{ flex: 1, fontSize: 13 }}>
                        <div>{step.text}</div>
                        {step.distance > 0 && (
                          <span className="muted" style={{ fontSize: 11, fontFamily: "JetBrains Mono" }}>
                            {fmtDistance(step.distance)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 48 }}>
            <MapPin size={40} className="muted" style={{ marginBottom: 12 }} />
            <p className="muted">This bay has not been calibrated with GPS coordinates yet. Administrators can calibrate coordinates in Orbit Control.</p>
          </div>
        )}
      </div>
    </div>
  );
}
