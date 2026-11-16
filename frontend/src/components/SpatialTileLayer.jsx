import { useEffect, useRef, useState } from "react";
import { TileLayer } from "react-leaflet";
import { MAPBOX_TOKEN, TILE_PROVIDERS, hasMapboxToken } from "../config";
import { useTheme } from "../ThemeContext.jsx";

// Tile sources to try for each layer, best first. Mapbox is used only when a token is set.
function providersFor(mode, isDark) {
  const P = TILE_PROVIDERS;
  const mapbox = hasMapboxToken() ? [mode === "satellite" ? P.mapboxSatellite : P.mapboxStreets] : [];
  if (mode === "satellite") return [...mapbox, P.esriImagery];
  return [...mapbox, isDark ? P.stadiaDark : P.stadiaLight, P.osm];
}

// A single failed tile can be a network blip; several mean the source is down or refusing us.
const FAILS_BEFORE_SWITCH = 3;

export default function SpatialTileLayer({ mode = "satellite", onStatus }) {
  const { isDark } = useTheme();
  const providers = providersFor(mode, isDark);
  const chainKey = `${mode}-${isDark}`;

  // Which fallback we are on, remembered per layer so switching layers starts from the best source.
  const [fallback, setFallback] = useState({ key: chainKey, index: 0 });
  const index = fallback.key === chainKey ? fallback.index : 0;
  const provider = providers[index];

  const fails = useRef({ name: null, count: 0 });

  useEffect(() => {
    onStatus?.(provider.name);
  }, [provider.name, onStatus]);

  const onTileError = () => {
    if (fails.current.name !== provider.name) fails.current = { name: provider.name, count: 0 };
    fails.current.count += 1;
    if (fails.current.count >= FAILS_BEFORE_SWITCH && index < providers.length - 1) {
      setFallback({ key: chainKey, index: index + 1 });
    }
  };

  const url = typeof provider.url === "function" ? provider.url(MAPBOX_TOKEN) : provider.url;

  return (
    <TileLayer
      key={url}
      url={url}
      attribution={provider.attribution}
      maxNativeZoom={provider.maxNativeZoom}
      maxZoom={21}
      eventHandlers={{ tileerror: onTileError }}
    />
  );
}
