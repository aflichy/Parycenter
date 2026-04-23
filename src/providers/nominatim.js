// Geocoding provider: Nominatim (OSM). No key. Strict 1 req/s rate limit.
// https://operations.osmfoundation.org/policies/nominatim/

import { trackedFetch } from "../stats.js";

const ID = "nominatim";
const SEARCH = "https://nominatim.openstreetmap.org/search";
const REVERSE = "https://nominatim.openstreetmap.org/reverse";
const MIN_INTERVAL_MS = 1100;

let lastCallAt = 0;

async function throttle() {
  const since = Date.now() - lastCallAt;
  if (since < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - since));
  }
  lastCallAt = Date.now();
}

function parseHit(d) {
  return {
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    displayName: d.display_name,
  };
}

export const nominatimProvider = {
  id: ID,
  name: "Nominatim (OpenStreetMap)",
  requiresKey: false,
  homepage: "https://nominatim.openstreetmap.org/",

  async geocode(address) {
    await throttle();
    const url = new URL(SEARCH);
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    const res = await trackedFetch(ID, url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    if (!data.length) throw new Error(`Address not found: ${address}`);
    return parseHit(data[0]);
  },

  async autocomplete(query, { signal } = {}) {
    await throttle();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const url = new URL(SEARCH);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    const res = await trackedFetch(ID, url.toString(), {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    return data.map(parseHit);
  },

  async reverse(lat, lon) {
    await throttle();
    const url = new URL(REVERSE);
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    url.searchParams.set("format", "json");
    const res = await trackedFetch(ID, url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Nominatim reverse ${res.status}`);
    const data = await res.json();
    if (!data.display_name) throw new Error("Reverse geocoding returned no result");
    return parseHit(data);
  },
};
