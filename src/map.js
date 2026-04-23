// Leaflet rendering. Uses the global `L` loaded via CDN in index.html.

const DEFAULT_VIEW = [48.8566, 2.3522]; // Paris
const DEFAULT_ZOOM = 12;

let map;
let participantLayer;
let poiLayer;

export function initMap() {
  map = L.map("map").setView(DEFAULT_VIEW, DEFAULT_ZOOM);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  participantLayer = L.layerGroup().addTo(map);
  poiLayer = L.layerGroup().addTo(map);
  return map;
}

export function renderParticipants(participants) {
  participantLayer.clearLayers();
  participants.forEach((p, i) => {
    const icon = L.divIcon({
      className: "",
      html: `<div class="marker-participant">${i + 1}</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    L.marker([p.lat, p.lon], { icon })
      .bindPopup(`<strong>Personne ${i + 1}</strong><br>${escapeHtml(p.displayName ?? "")}<br><em>${modeLabel(p.mode)}</em>`)
      .addTo(participantLayer);
  });
}

export function renderResults(ranked) {
  poiLayer.clearLayers();
  ranked.forEach((r, i) => {
    const icon = L.divIcon({
      className: "",
      html: `<div class="marker-rank">${i + 1}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([r.poi.lat, r.poi.lon], { icon })
      .bindPopup(popupHtml(r, i))
      .addTo(poiLayer);
  });
}

export function fitToAll(participants, pois) {
  const pts = [
    ...participants.map((p) => [p.lat, p.lon]),
    ...pois.map((r) => [r.poi.lat, r.poi.lon]),
  ];
  if (!pts.length) return;
  map.fitBounds(pts, { padding: [40, 40] });
}

export function focusPoi(index) {
  const layers = poiLayer.getLayers();
  const layer = layers[index];
  if (!layer) return;
  map.setView(layer.getLatLng(), Math.max(map.getZoom(), 15));
  layer.openPopup();
}

function popupHtml(r, rank) {
  const breakdown = r.perParticipant
    .map((t, i) => `Personne ${i + 1} : ${Math.round(t / 60)} min`)
    .join("<br>");
  return `
    <strong>#${rank + 1} — ${escapeHtml(r.poi.name)}</strong>
    <div style="font-size:11px;color:#666;margin-top:2px">${r.poi.kind}</div>
    <div style="margin-top:6px">Max : <strong>${Math.round(r.score / 60)} min</strong></div>
    <div style="font-size:11px;color:#666;margin-top:4px">${breakdown}</div>
  `;
}

function modeLabel(mode) {
  return {
    walk: "à pied",
    bike: "à vélo",
    car: "en voiture",
    transit: "en transports",
  }[mode] ?? mode;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
