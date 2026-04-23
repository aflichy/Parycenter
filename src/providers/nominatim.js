// Geocoding provider: Nominatim (OSM). No key. Strict 1 req/s rate limit.
// https://operations.osmfoundation.org/policies/nominatim/

import { trackedFetch } from "../stats.js";
import { ProviderError } from "../errors.js";

const ID = "nominatim";

function checkResponse(res) {
  if (res.ok) return;
  if (res.status === 429) {
    throw new ProviderError({
      code: "rate_limited",
      providerId: ID,
      params: { provider: "Nominatim" },
      fallback: "Nominatim rate limited (429)",
    });
  }
  throw new ProviderError({
    code: "http_error",
    providerId: ID,
    params: { provider: "Nominatim", status: res.status },
    fallback: `Nominatim HTTP ${res.status}`,
  });
}
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
    checkResponse(res);
    const data = await res.json();
    if (!data.length) {
      throw new ProviderError({
        code: "address_not_found",
        providerId: ID,
        params: { address },
        fallback: `Address not found: ${address}`,
      });
    }
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
    checkResponse(res);
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
    checkResponse(res);
    const data = await res.json();
    if (!data.display_name) {
      throw new ProviderError({
        code: "address_not_found",
        providerId: ID,
        params: { address: `${lat},${lon}` },
        fallback: "Reverse geocoding returned no result",
      });
    }
    return parseHit(data);
  },
};
