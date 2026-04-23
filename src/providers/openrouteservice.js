// Routing provider: OpenRouteService. Handles walk/bike/car via its matrix endpoint.
// https://openrouteservice.org/dev/#/api-docs/v2/matrix

const MATRIX = "https://api.openrouteservice.org/v2/matrix";

const PROFILE_BY_MODE = {
  walk: "foot-walking",
  bike: "cycling-regular",
  car: "driving-car",
};

export const openRouteServiceProvider = {
  id: "openrouteservice",
  name: "OpenRouteService",
  requiresKey: true,
  homepage: "https://openrouteservice.org/",
  signupUrl: "https://openrouteservice.org/dev/#/signup",
  supportedModes: ["walk", "bike", "car"],

  async computeMatrix({ sources, destinations, mode, apiKey, onProgress }) {
    const profile = PROFILE_BY_MODE[mode];
    if (!profile) throw new Error(`ORS: mode non supporté ${mode}`);
    if (!apiKey) throw new Error("Clé OpenRouteService manquante");

    // ORS expects [lon, lat].
    const locations = [
      ...sources.map((s) => [s.lon, s.lat]),
      ...destinations.map((d) => [d.lon, d.lat]),
    ];
    const srcIdx = sources.map((_, i) => i);
    const dstIdx = destinations.map((_, j) => sources.length + j);

    onProgress?.(`Routing ${profile} (${sources.length} → ${destinations.length})…`);

    const res = await fetch(`${MATRIX}/${profile}`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        locations,
        sources: srcIdx,
        destinations: dstIdx,
        metrics: ["duration"],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ORS ${profile} ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return sources.map((_, i) =>
      destinations.map((_, j) => data.durations?.[i]?.[j] ?? null)
    );
  },
};
