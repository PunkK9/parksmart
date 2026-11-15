import { useEffect, useState } from "react";
import { TileLayer } from "react-leaflet";
import { MAPBOX_TOKEN, TILE_PROVIDERS, hasMapboxToken } from "../config";
import { useTheme } from "../ThemeContext.jsx";

/**
 * Mapbox satellite or streets, with a CARTO streets fallback when the token
 * is missing or Mapbox tiles fail to load.
 */
export default function SpatialTileLayer({ mode = "satellite", onStatus }) {
  const { isDark } = useTheme();
  const [failed, setFailed] = useState(false);
  const tokenOk = hasMapboxToken();

  useEffect(() => {
    setFailed(false);
  }, [mode, tokenOk]);

  useEffect(() => {
    if (!onStatus) return;
    if (mode === "satellite" && tokenOk && !failed) onStatus("Mapbox Satellite");
    else if (mode === "streets" && tokenOk && !failed) onStatus("Mapbox Streets");
    else onStatus(mode === "satellite" ? "Streets fallback" : "Streets");
  }, [mode, tokenOk, failed, onStatus]);

  const onTileError = () => setFailed(true);

  if (mode === "satellite" && tokenOk && !failed) {
    return (
      <TileLayer
        key="mapbox-satellite"
        attribution={TILE_PROVIDERS.mapboxSatellite.attribution}
        url={TILE_PROVIDERS.mapboxSatellite.url(MAPBOX_TOKEN)}
        maxZoom={TILE_PROVIDERS.mapboxSatellite.maxZoom}
        eventHandlers={{ tileerror: onTileError }}
      />
    );
  }

  if (mode === "streets" && tokenOk && !failed) {
    return (
      <TileLayer
        key="mapbox-streets"
        attribution={TILE_PROVIDERS.mapboxStreets.attribution}
        url={TILE_PROVIDERS.mapboxStreets.url(MAPBOX_TOKEN)}
        maxZoom={TILE_PROVIDERS.mapboxStreets.maxZoom}
        eventHandlers={{ tileerror: onTileError }}
      />
    );
  }

  const streets = isDark ? TILE_PROVIDERS.darkVector : TILE_PROVIDERS.streets;
  return (
    <TileLayer
      key={isDark ? "carto-dark" : "carto-streets"}
      attribution={streets.attribution}
      url={streets.url}
      maxZoom={streets.maxZoom}
    />
  );
}
