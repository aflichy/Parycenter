// Pure geometric helpers — no I/O, no dependencies. Easy to unit-test.

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
  if (!points.length) throw new Error("barycenter: empty input");
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lon = points.reduce((s, p) => s + p.lon, 0) / points.length;
  return { lat, lon };
}
