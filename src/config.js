// Config state: active provider per service + their API keys. Persisted in localStorage.

const STORAGE_KEY = "parycenter-config";
const LEGACY_STORAGE_KEYS = ["bitm-config"];

const DEFAULTS = {
  geocoding: {
    providerId: "nominatim",
    keys: {},
  },
  pois: {
    providerId: "overpass",
    keys: {},
  },
  routing: {
    // Which provider handles each travel mode.
    modeProviders: {
      walk: "openrouteservice",
      bike: "openrouteservice",
      car: "openrouteservice",
      transit: "transitous",
    },
    keys: {},
  },
};

function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    // Migrate from older storage keys.
    if (!raw) {
      for (const legacy of LEGACY_STORAGE_KEYS) {
        const legacyRaw = localStorage.getItem(legacy);
        if (legacyRaw) {
          raw = legacyRaw;
          localStorage.setItem(STORAGE_KEY, legacyRaw);
          localStorage.removeItem(legacy);
          break;
        }
      }
    }
    const parsed = raw ? JSON.parse(raw) : {};
    return deepMerge(structuredClone(DEFAULTS), parsed);
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source ?? {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      target[k] = deepMerge(target[k] ?? {}, v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

const state = load();

// One-time migration from the previous flat "ors-key" storage.
const legacyOrsKey = localStorage.getItem("ors-key");
if (legacyOrsKey && !state.routing.keys.openrouteservice) {
  state.routing.keys.openrouteservice = legacyOrsKey;
  save(state);
  localStorage.removeItem("ors-key");
}

export function getConfig() {
  return state;
}

export function setProvider(service, providerId) {
  state[service].providerId = providerId;
  save(state);
}

export function setModeProvider(mode, providerId) {
  state.routing.modeProviders[mode] = providerId;
  save(state);
}

export function setKey(service, providerId, key) {
  state[service].keys[providerId] = key;
  save(state);
}

export function getKey(service, providerId) {
  return state[service].keys[providerId] ?? "";
}
