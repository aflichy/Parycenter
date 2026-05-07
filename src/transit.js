// On-demand fetch of Paris metro line geometries from Île-de-France Mobilités.
// We pass `where=mode="METRO"` so filtering happens server-side; the response
// is cached in memory (and dedup'd via inflight) so toggling off/on is free.

import { ProviderError } from "./errors.js";

const LINES_URL =
  "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/" +
  "traces-du-reseau-ferre-idf/exports/geojson" +
  "?where=mode%3D%22METRO%22" +
  "&select=mode,indice_lig,colourweb_hexa,res_com";

const STATIONS_URL =
  "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/" +
  "emplacement-des-gares-idf/exports/geojson" +
  "?where=mode%3D%22METRO%22" +
  "&select=nom_gares,indice_lig,id_ref_zda,res_com";

function memoizedGeoJSON(url, transform = (x) => x) {
  let cache = null;
  let inflight = null;
  return async () => {
    if (cache) return cache;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new ProviderError("http_error", { provider: "IDFM", status: res.status });
        cache = transform(await res.json());
        return cache;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };
}

export const fetchMetroLines = memoizedGeoJSON(LINES_URL);

// Stations appear once per (station, line) — collapse to one feature per
// physical station, with the full list of lines aggregated for the tooltip.
export const fetchMetroStations = memoizedGeoJSON(STATIONS_URL, (geojson) => {
  const byZda = new Map();
  for (const f of geojson.features ?? []) {
    const id = f.properties?.id_ref_zda;
    if (!id) continue;
    const existing = byZda.get(id);
    if (existing) {
      existing.properties.lines.push(f.properties.indice_lig);
    } else {
      byZda.set(id, {
        ...f,
        properties: {
          ...f.properties,
          lines: [f.properties.indice_lig],
        },
      });
    }
  }
  for (const f of byZda.values()) {
    f.properties.lines.sort((a, b) => {
      const na = parseInt(a, 10), nb = parseInt(b, 10);
      return na - nb || String(a).localeCompare(String(b));
    });
  }
  return { type: "FeatureCollection", features: [...byZda.values()] };
});
