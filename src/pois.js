// POI service: registry + dispatcher + geometric helpers.

import { overpassProvider } from "./providers/overpass.js";
import { getConfig, getKey } from "./config.js";

const providers = {
  [overpassProvider.id]: overpassProvider,
};

export function listPoiProviders() {
  return Object.values(providers);
}

export function getActivePoiProvider() {
  const cfg = getConfig().pois;
  return providers[cfg.providerId] ?? overpassProvider;
}

export async function fetchPOIs(args) {
  const provider = getActivePoiProvider();
  const apiKey = getKey("pois", provider.id);
  return provider.fetchPOIs(args, { apiKey });
}

// ---- Geometric helpers (provider-agnostic) ----

export function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function prefilterByDistance(pois, center, max) {
  return pois
    .map((p) => ({ poi: p, d: haversineMeters(center, p) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map(({ poi }) => poi);
}

export function barycenter(points) {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lon = points.reduce((s, p) => s + p.lon, 0) / points.length;
  return { lat, lon };
}
