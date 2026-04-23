// Geocoding service: registry + dispatcher. The active provider comes from config.

import { nominatimProvider } from "./providers/nominatim.js";
import { getConfig, getKey } from "./config.js";

const providers = {
  [nominatimProvider.id]: nominatimProvider,
  // Add more here (Mapbox, Photon, Geoapify, …). No other code needs to change.
};

const cache = new Map();

export function listGeocodingProviders() {
  return Object.values(providers);
}

export function getActiveGeocodingProvider() {
  const cfg = getConfig().geocoding;
  return providers[cfg.providerId] ?? nominatimProvider;
}

export async function geocode(address) {
  const provider = getActiveGeocodingProvider();
  const apiKey = getKey("geocoding", provider.id);
  const cacheKey = `${provider.id}::${address.trim().toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const hit = await provider.geocode(address, { apiKey });
  cache.set(cacheKey, hit);
  return hit;
}

export async function geocodeAll(addresses, onProgress) {
  const out = [];
  for (let i = 0; i < addresses.length; i++) {
    onProgress?.(i, addresses.length, addresses[i]);
    out.push(await geocode(addresses[i]));
  }
  return out;
}
