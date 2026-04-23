// POI service: registry + dispatcher.

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
