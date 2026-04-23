// Routing service: per-mode dispatcher over pluggable providers.
// Each mode is owned by the provider listed in config.routing.modeProviders[mode].

import { openRouteServiceProvider } from "./providers/openrouteservice.js";
import { transitousProvider } from "./providers/transitous.js";
import { getConfig, getKey } from "./config.js";

const providers = {
  [openRouteServiceProvider.id]: openRouteServiceProvider,
  [transitousProvider.id]: transitousProvider,
};

export function listRoutingProviders() {
  return Object.values(providers);
}

export function providersForMode(mode) {
  return Object.values(providers).filter((p) => p.supportedModes.includes(mode));
}

export function getActiveRoutingProvider(mode) {
  const id = getConfig().routing.modeProviders[mode];
  return providers[id] ?? providersForMode(mode)[0];
}

// Compute travel time matrix: times[participantIdx][poiIdx] in seconds, or null if unreachable.
export async function computeTimes({ participants, pois, onProgress }) {
  const n = participants.length;
  const m = pois.length;
  const times = Array.from({ length: n }, () => Array(m).fill(null));

  // Group participants by (mode, providerId). Same mode + same provider = one matrix call.
  const groups = new Map();
  participants.forEach((p, idx) => {
    const provider = getActiveRoutingProvider(p.mode);
    if (!provider) throw new Error(`Aucun provider configuré pour le mode ${p.mode}`);
    const key = `${provider.id}::${p.mode}`;
    if (!groups.has(key)) groups.set(key, { provider, mode: p.mode, members: [] });
    groups.get(key).members.push({ ...p, idx });
  });

  const tasks = [];
  for (const { provider, mode, members } of groups.values()) {
    tasks.push(
      (async () => {
        const apiKey = getKey("routing", provider.id);
        const matrix = await provider.computeMatrix({
          sources: members,
          destinations: pois,
          mode,
          apiKey,
          onProgress,
        });
        members.forEach((m, i) => {
          for (let j = 0; j < pois.length; j++) {
            times[m.idx][j] = matrix[i][j];
          }
        });
      })()
    );
  }
  await Promise.all(tasks);
  return times;
}
