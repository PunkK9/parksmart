// Orbit Spatial Parking & Telemetry Configuration

export const PRODUCT_NAME = "Orbit";
export const FACILITY_NAME = "Orbit Gateway — Campus Innovation Hub";
export const ENTRANCE = { lat: 13.0293, lng: 77.5641, name: "Orbit Main Gateway" };
export const HOLD_MINUTES = 15;

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

export const TILE_PROVIDERS = {
  mapboxSatellite: {
    name: "Mapbox Satellite",
    url: (token) =>
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`,
    maxZoom: 22,
    attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; OpenStreetMap',
  },
  mapboxStreets: {
    name: "Mapbox Streets",
    url: (token) =>
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`,
    maxZoom: 22,
    attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; OpenStreetMap',
  },
  streets: {
    name: "Streets",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    maxZoom: 20,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
  },
  darkVector: {
    name: "Streets",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    maxZoom: 20,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
  },
};

export function hasMapboxToken() {
  return Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith("pk.") && !MAPBOX_TOKEN.includes("example"));
}
