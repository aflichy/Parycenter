// Minimal i18n: string tables + t() with {placeholder} substitution.
// Persists the active language in localStorage; defaults to the browser locale.

import { ProviderError } from "./errors.js";

const STORAGE_KEY = "parycenter-lang";
const SUPPORTED = ["en", "fr"];

const strings = {
  en: {
    tagline: "The fairest bar or restaurant for the whole group.",
    toggleTheme: "Toggle theme",
    toggleLang: "Switch language",

    participants: "Participants",
    addPerson: "+ Add a person",
    addressPlaceholder: "Address",
    remove: "Remove",
    useMyLocation: "Use my location",

    target: "Target",
    bar: "Bar",
    pub: "Pub",
    restaurant: "Restaurant",
    numResults: "Number of results",
    searchRadius: "Search radius",

    settings: "⚙ Service configuration",
    geocoding: "Geocoding",
    poi: "POI",
    routingPerMode: "Routing (per mode)",
    apiKeys: "API keys",
    getKey: "Get a key ↗",
    providerKeyPlaceholder: "{provider} key",
    usage: "Usage",
    usageCalls: { one: "{n} call", other: "{n} calls" },
    usageErrors: { one: "{n} error", other: "{n} errors" },
    usageRateLimited: "rate limited",

    mode_walk: "Walk",
    mode_bike: "Bike",
    mode_car: "Car",
    mode_transit: "Transit",

    findSpot: "Find the spot",

    results: "Results",
    personN: "Person {n}",
    openInGoogleMaps: "Open in Google Maps ↗",
    maxLabel: "Max",

    statusGeocoding: "Geocoding addresses…",
    statusGeocodingProgress: "Geocoding {i}/{total}: {addr}",
    statusSearchingPOI: "Searching bars and restaurants around the barycenter…",
    statusFiltered: "{total} venues → {kept} candidates to route.",
    statusResults: {
      one: "{n} result. Best: {time} max.",
      other: "{n} results. Best: {time} max.",
    },
    statusDetectingLocation: "Detecting your location…",
    statusReverseGeocoding: "Reverse geocoding…",

    errMinParticipants: "At least 2 participants.",
    errAllAddresses: "All addresses must be filled in.",
    errAtLeastOneKind: "Tick at least one venue type.",
    errNoProvider: "No provider configured for {mode}.",
    errKeyRequired: "{provider} key required (mode {mode}).",
    errNoVenues: "No venue found within this radius.",
    errNoneReachable: "No venue reachable by every participant.",
    errGeoNotAvailable: "Geolocation not available in this browser.",

    providerError_address_not_found: "Address not found: {address}",
    providerError_rate_limited: "{provider} is rate-limited. Wait a moment and retry.",
    providerError_http_error: "{provider} returned HTTP {status}.",
    providerError_missing_key: "{provider} API key is required.",

    popup_onFoot: "on foot",
    popup_byBike: "by bike",
    popup_byCar: "by car",
    popup_byTransit: "by transit",
  },
  fr: {
    tagline: "Le bar ou resto le plus juste pour tout le groupe.",
    toggleTheme: "Changer de thème",
    toggleLang: "Changer de langue",

    participants: "Participants",
    addPerson: "+ Ajouter une personne",
    addressPlaceholder: "Adresse",
    remove: "Retirer",
    useMyLocation: "Utiliser ma position",

    target: "Cible",
    bar: "Bar",
    pub: "Pub",
    restaurant: "Restaurant",
    numResults: "Nombre de résultats",
    searchRadius: "Rayon de recherche",

    settings: "⚙ Configuration des services",
    geocoding: "Géocodage",
    poi: "POI",
    routingPerMode: "Routing (par mode)",
    apiKeys: "Clés API",
    getKey: "Obtenir une clé ↗",
    providerKeyPlaceholder: "Clé {provider}",
    usage: "Utilisation",
    usageCalls: { one: "{n} appel", other: "{n} appels" },
    usageErrors: { one: "{n} erreur", other: "{n} erreurs" },
    usageRateLimited: "quota dépassé",

    mode_walk: "Marche",
    mode_bike: "Vélo",
    mode_car: "Voiture",
    mode_transit: "Transports",

    findSpot: "Trouver le spot",

    results: "Résultats",
    personN: "Personne {n}",
    openInGoogleMaps: "Ouvrir dans Google Maps ↗",
    maxLabel: "Max",

    statusGeocoding: "Géocodage des adresses…",
    statusGeocodingProgress: "Géocodage {i}/{total} : {addr}",
    statusSearchingPOI: "Recherche des bars et restos autour du barycentre…",
    statusFiltered: "{total} lieux → {kept} candidats à router.",
    statusResults: {
      one: "{n} résultat. Meilleur : {time} max.",
      other: "{n} résultats. Meilleur : {time} max.",
    },
    statusDetectingLocation: "Détection de votre position…",
    statusReverseGeocoding: "Géocodage inverse…",

    errMinParticipants: "Au moins 2 participants.",
    errAllAddresses: "Toutes les adresses doivent être remplies.",
    errAtLeastOneKind: "Cocher au moins un type de lieu.",
    errNoProvider: "Aucun provider configuré pour {mode}.",
    errKeyRequired: "Clé {provider} requise (mode {mode}).",
    errNoVenues: "Aucun lieu trouvé dans ce rayon.",
    errNoneReachable: "Aucun lieu joignable par tous les participants.",
    errGeoNotAvailable: "Géolocalisation non disponible dans ce navigateur.",

    providerError_address_not_found: "Adresse introuvable : {address}",
    providerError_rate_limited: "{provider} a atteint son quota. Attendez un instant puis réessayez.",
    providerError_http_error: "{provider} a renvoyé une erreur HTTP {status}.",
    providerError_missing_key: "La clé API {provider} est requise.",

    popup_onFoot: "à pied",
    popup_byBike: "à vélo",
    popup_byCar: "en voiture",
    popup_byTransit: "en transports",
  },
};

function detect() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (SUPPORTED.includes(saved)) return saved;
  const sys = (navigator.language || "en").slice(0, 2).toLowerCase();
  return SUPPORTED.includes(sys) ? sys : "en";
}

let current = detect();
const listeners = new Set();

function syncHtmlLang() {
  if (typeof document !== "undefined") {
    document.documentElement.lang = current;
  }
}
syncHtmlLang();

export function getLang() { return current; }

export function setLang(lang) {
  if (!SUPPORTED.includes(lang)) return;
  current = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  syncHtmlLang();
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const pluralRules = new Map();
function plural(lang) {
  if (!pluralRules.has(lang)) pluralRules.set(lang, new Intl.PluralRules(lang));
  return pluralRules.get(lang);
}

export function t(key, params = {}) {
  let s = strings[current]?.[key] ?? strings.en[key] ?? key;

  // Plural form: value is an object keyed by CLDR plural categories (one/other/…).
  // Selected based on params.n using the active locale's plural rules.
  if (s && typeof s === "object" && typeof params.n === "number") {
    const rule = plural(current).select(params.n);
    s = s[rule] ?? s.other ?? String(key);
  }

  if (typeof s !== "string") return String(key);

  for (const [k, v] of Object.entries(params)) {
    s = s.replaceAll(`{${k}}`, v);
  }
  return s;
}

// Localize a thrown error. ProviderError carries a code + params; unknown
// codes and non-provider errors fall back to the raw message.
export function localizeError(err) {
  if (err instanceof ProviderError) {
    const key = `providerError_${err.code}`;
    const localized = t(key, err.params);
    if (localized !== key) return localized;
  }
  return err?.message ?? String(err);
}

// Apply t() to every element carrying a data-i18n / data-i18n-placeholder / data-i18n-title attribute.
export function applyI18n(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll("[data-i18n-placeholder]")) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  for (const el of root.querySelectorAll("[data-i18n-title]")) {
    el.title = t(el.dataset.i18nTitle);
  }
}
