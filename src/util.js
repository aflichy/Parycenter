// Use coordinates only as the query. Mixing a name with coords makes Google
// prioritize text matching and can land on a same-named place in another
// country. Coord-only drops a pin at the exact spot — reliable even if the
// POI is unnamed on Google's side.
export function googleMapsUrl({ lat, lon }) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
