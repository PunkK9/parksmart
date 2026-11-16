import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, ZoomControl, useMap } from "react-leaflet";
import { Layers, MapPin, Navigation, Satellite, X } from "lucide-react";
import L from "leaflet";
import { ENTRANCE } from "../config";
import { compassDirection, fmtDistance, fmtDuration, haversine } from "../utils";
import SpatialTileLayer from "./SpatialTileLayer.jsx";

// Campus paths are not on any public road map, so a routing service can't give a real
// route from the gate to a bay. We show the straight walking line, which is honest.
const WALK_SPEED = 1.3; // metres per second, a normal walking pace

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

// Keep both pins in view, with room at the top for the floating label and layer switch.
function FitBoth({ from, to }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([[from.lat, from.lng], [to.lat, to.lng]], {
      paddingTopLeft: [60, 90],
      paddingBottomRight: [60, 60],
      maxZoom: 20,
    });
  }, [map, from.lat, from.lng, to.lat, to.lng]);
  return null;
}

export default function RouteMap({ slot, onClose }) {
  const [layer, setLayer] = useState("satellite");
  const slotPos = useMemo(() => ({ lat: slot.lat, lng: slot.lng }), [slot.lat, slot.lng]);
  const hasCoords = typeof slot.lat === "number" && typeof slot.lng === "number";
  const distance = hasCoords ? haversine(ENTRANCE, slotPos) : null;
  const direction = hasCoords ? compassDirection(ENTRANCE, slotPos) : null;
  const line = hasCoords ? [[ENTRANCE.lat, ENTRANCE.lng], [slot.lat, slot.lng]] : [];

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900, width: "95%" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2>Directions to Bay {slot.code}</h2>
              <span className="badge badge-completed">
                Zone {slot.zone} · {slot.vehicleType}
              </span>
            </div>
            <p className="muted" style={{ marginTop: 4 }}>
              {hasCoords
                ? `From the ${ENTRANCE.name.toLowerCase()}, head ${direction} for about ${fmtDistance(distance)}.`
                : `Bay ${slot.code} in Zone ${slot.zone}`}
            </p>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {hasCoords ? (
          <>
            <div className="spatial-map-wrap" style={{ height: "min(430px, 55vh)" }}>
              <div className="map-hud-top">
                <div className="map-hud-pill">
                  <Navigation size={13} style={{ color: "var(--brand)" }} />
                  <span>{ENTRANCE.name} → Bay {slot.code}</span>
                </div>

                <div className="segment-ctrl">
                  <button
                    type="button"
                    className={`segment-btn ${layer === "satellite" ? "active" : ""}`}
                    onClick={() => setLayer("satellite")}
                  >
                    <Satellite size={12} /> Satellite
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${layer === "streets" ? "active" : ""}`}
                    onClick={() => setLayer("streets")}
                  >
                    <Layers size={12} /> Streets
                  </button>
                </div>
              </div>

              <MapContainer
                center={[slot.lat, slot.lng]}
                zoom={19}
                zoomSnap={0.5}
                maxZoom={21}
                zoomControl={false}
                style={{ height: "100%", width: "100%" }}
              >
                <ZoomControl position="bottomright" />
                <SpatialTileLayer mode={layer} />

                <Polyline positions={line} pathOptions={{ color: "#0f172a", weight: 10, opacity: 0.55 }} />
                <Polyline
                  positions={line}
                  pathOptions={{ color: "#38bdf8", weight: 5, dashArray: "1 12", lineCap: "round" }}
                />

                <Marker position={[ENTRANCE.lat, ENTRANCE.lng]} icon={createPin("pin-entrance", "GATE", ENTRANCE.name)} />
                <Marker position={[slot.lat, slot.lng]} icon={createPin("pin-destination", slot.code, `Bay ${slot.code}`)} />
                <FitBoth from={ENTRANCE} to={slotPos} />
              </MapContainer>
            </div>

            <div className="route-stats">
              <div className="card">
                <span className="kpi-label">Distance</span>
                <strong style={{ color: "var(--ink)" }}>{fmtDistance(distance)}</strong>
                <span className="muted">Straight line from the gate</span>
              </div>
              <div className="card">
                <span className="kpi-label">On foot</span>
                <strong style={{ color: "var(--brand)" }}>About {fmtDuration(distance / WALK_SPEED)}</strong>
                <span className="muted">At a normal walking pace</span>
              </div>
              <div className="card">
                <span className="kpi-label">Direction</span>
                <strong style={{ color: "var(--ok)", textTransform: "capitalize" }}>{direction}</strong>
                <span className="muted">From the gate</span>
              </div>
            </div>
          </>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 48 }}>
            <MapPin size={40} className="muted" style={{ marginBottom: 12 }} />
            <p className="muted">This bay has no map location yet. An admin can add one in Admin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
