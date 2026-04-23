// POI provider: Overpass API (OSM). No key.
// https://wiki.openstreetmap.org/wiki/Overpass_API

const ENDPOINT = "https://overpass-api.de/api/interpreter";

export const overpassProvider = {
  id: "overpass",
  name: "Overpass (OpenStreetMap)",
  requiresKey: false,
  homepage: "https://overpass-api.de/",

  async fetchPOIs({ lat, lon, radiusMeters, kinds }) {
    if (!kinds.length) return [];
    const amenityRegex = kinds.join("|");
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"^(${amenityRegex})$"]["name"](around:${radiusMeters},${lat},${lon});
        way["amenity"~"^(${amenityRegex})$"]["name"](around:${radiusMeters},${lat},${lon});
      );
      out center tags;
    `.trim();

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);

    const data = await res.json();
    return data.elements
      .map((el) => {
        const coords = el.type === "node"
          ? { lat: el.lat, lon: el.lon }
          : el.center ? { lat: el.center.lat, lon: el.center.lon } : null;
        if (!coords) return null;
        return {
          id: `${el.type}/${el.id}`,
          name: el.tags?.name ?? "(sans nom)",
          kind: el.tags?.amenity,
          lat: coords.lat,
          lon: coords.lon,
        };
      })
      .filter(Boolean);
  },
};
