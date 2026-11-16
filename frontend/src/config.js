// Orbit Spatial Parking & Telemetry Configuration

export const PRODUCT_NAME = "Orbit";
export const FACILITY_NAME = "Campus Parking";
export const ENTRANCE = { lat: 13.0293, lng: 77.5641, name: "Main Gate" };
export const HOLD_MINUTES = 15;

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

export const TILE_PROVIDERS = {
  mapboxSatellite: {
    name: "Mapbox Satellite",
    url: (token) =>
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`,
    maxNativeZoom: 22,
    attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; OpenStreetMap',
  },
  mapboxStreets: {
    name: "Mapbox Streets",
    url: (token) =>
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`,
    maxNativeZoom: 22,
    attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; OpenStreetMap',
  },
  // Keyless fallbacks. (CARTO basemaps now return "API KEY REQUIRED" tiles, so they are gone.)
  esriImagery: {
    name: "Esri Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 19,
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
  },
  // Stadia needs no key on localhost; a deployed domain must be registered (free) at stadiamaps.com.
  stadiaDark: {
    name: "Streets",
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    maxNativeZoom: 20,
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; OpenMapTiles &copy; OpenStreetMap',
  },
  stadiaLight: {
    name: "Streets",
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
    maxNativeZoom: 20,
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; OpenMapTiles &copy; OpenStreetMap',
  },
  osm: {
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxNativeZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

export function hasMapboxToken() {
  return Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith("pk.") && !MAPBOX_TOKEN.includes("example"));
}
