// Geocoding provider: Nominatim (OSM). No key. Strict 1 req/s rate limit.
// https://operations.osmfoundation.org/policies/nominatim/

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const MIN_INTERVAL_MS = 1100;

let lastCallAt = 0;

async function throttle() {
  const since = Date.now() - lastCallAt;
  if (since < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - since));
  }
  lastCallAt = Date.now();
}

export const nominatimProvider = {
  id: "nominatim",
  name: "Nominatim (OpenStreetMap)",
  requiresKey: false,
  homepage: "https://nominatim.openstreetmap.org/",

  async geocode(address) {
    await throttle();
    const url = new URL(ENDPOINT);
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    if (!data.length) throw new Error(`Address not found: ${address}`);
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  },
};
