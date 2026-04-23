// Leaflet rendering. Uses the global `L` loaded via CDN in index.html.

import { googleMapsUrl, escapeHtml } from "./util.js";
import { t } from "./i18n.js";

const DEFAULT_VIEW = [48.8566, 2.3522]; // Paris
const DEFAULT_ZOOM = 12;

const TILES = {
  light: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: "abc",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
};

let map;
let tileLayer;
let participantLayer;
let poiLayer;

export function initMap() {
  map = L.map("map").setView(DEFAULT_VIEW, DEFAULT_ZOOM);
  participantLayer = L.layerGroup().addTo(map);
  poiLayer = L.layerGroup().addTo(map);
  return map;
}

export function setMapTheme(theme) {
  if (!map) return;
  const cfg = TILES[theme] ?? TILES.light;
  if (tileLayer) map.removeLayer(tileLayer);
  tileLayer = L.tileLayer(cfg.url, {
    maxZoom: 19,
    attribution: cfg.attribution,
    subdomains: cfg.subdomains,
  }).addTo(map);
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
      .bindPopup(
        `<strong>${t("personN", { n: i + 1 })}</strong><br>${escapeHtml(p.displayName ?? "")}<br><em>${modeLabel(p.mode)}</em>`
      )
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
  const layer = poiLayer.getLayers()[index];
  if (!layer) return;
  map.setView(layer.getLatLng(), Math.max(map.getZoom(), 15));
  layer.openPopup();
}

function popupHtml(r, rank) {
  const breakdown = r.perParticipant
    .map((secs, i) => `${t("personN", { n: i + 1 })}: ${Math.round(secs / 60)} min`)
    .join("<br>");
  const gmaps = googleMapsUrl(r.poi);
  return `
    <strong>#${rank + 1} — ${escapeHtml(r.poi.name)}</strong>
    <div class="popup-sub">${r.poi.kind}</div>
    <div class="popup-main">${t("maxLabel")}: <strong>${Math.round(r.score / 60)} min</strong></div>
    <div class="popup-sub">${breakdown}</div>
    <div class="popup-link"><a href="${gmaps}" target="_blank" rel="noopener">${t("openInGoogleMaps")}</a></div>
  `;
}

function modeLabel(mode) {
  const key = {
    walk: "popup_onFoot",
    bike: "popup_byBike",
    car: "popup_byCar",
    transit: "popup_byTransit",
  }[mode];
  return key ? t(key) : mode;
}
