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

const STATIONS_MIN_ZOOM = 14;

let map;
let tileLayer;
let participantLayer;
let poiLayer;
let metroLinesLayer;
let metroStationsLayer;
let metroStationsData = null;

export function initMap() {
  map = L.map("map", { zoomControl: false }).setView(DEFAULT_VIEW, DEFAULT_ZOOM);
  L.control.zoom({ position: "topright" }).addTo(map);
  participantLayer = L.layerGroup().addTo(map);
  poiLayer = L.layerGroup().addTo(map);
  map.on("zoomend", syncStationsVisibility);
  return map;
}

export function showMetroLines(geojson) {
  if (metroLinesLayer) return;
  metroLinesLayer = L.geoJSON(geojson, {
    style: (feature) => {
      const hex = feature.properties?.colourweb_hexa;
      return {
        color: hex ? `#${hex}` : "#888",
        weight: 3,
        opacity: 0.85,
      };
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.res_com ??
        `Ligne ${feature.properties?.indice_lig ?? ""}`;
      layer.bindTooltip(name, { sticky: true, direction: "top" });
    },
  }).addTo(map);
}

export function hideMetroLines() {
  if (!metroLinesLayer) return;
  map.removeLayer(metroLinesLayer);
  metroLinesLayer = null;
}

export function showMetroStations(geojson) {
  metroStationsData = geojson;
  syncStationsVisibility();
}

export function hideMetroStations() {
  metroStationsData = null;
  syncStationsVisibility();
}

// Stations only render at high zoom — 300+ markers at city zoom would clutter
// the map. We add/remove the layer on zoomend rather than toggling style so
// off-screen ticks are cheap.
function syncStationsVisibility() {
  if (!map) return;
  const shouldShow = metroStationsData && map.getZoom() >= STATIONS_MIN_ZOOM;
  if (shouldShow && !metroStationsLayer) {
    metroStationsLayer = L.geoJSON(metroStationsData, {
      pointToLayer: (_feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 4,
          fillColor: "#ffffff",
          color: "#1a1a1a",
          weight: 2,
          fillOpacity: 1,
        }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties ?? {};
        const lines = (p.lines ?? []).join(", ");
        const label = lines ? `${p.nom_gares} — M ${lines}` : p.nom_gares;
        layer.bindTooltip(label, { direction: "top" });
      },
    }).addTo(map);
  } else if (!shouldShow && metroStationsLayer) {
    map.removeLayer(metroStationsLayer);
    metroStationsLayer = null;
  }
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

function popupHtml(r, idx) {
  const breakdown = r.perParticipant
    .map((secs, i) => `${t("personN", { n: i + 1 })}: ${Math.round(secs / 60)} min`)
    .join("<br>");
  const gmaps = googleMapsUrl(r.poi);
  return `
    <strong>#${idx + 1} — ${escapeHtml(r.poi.name)}</strong>
    <div class="popup-sub">${escapeHtml(r.poi.kind)}</div>
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
