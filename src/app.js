import { geocodeAll } from "./geocoding.js";
import { fetchPOIs } from "./pois.js";
import { prefilterByDistance, barycenter } from "./geometry.js";
import {
  computeTimes,
  getActiveRoutingProvider,
} from "./routing.js";
import { getKey } from "./config.js";
import { rank, formatDuration } from "./scoring.js";
import { initMap, renderParticipants } from "./map.js";
import { t, getLang, setLang, onLangChange, applyI18n } from "./i18n.js";

import { applyTheme, currentTheme, toggleTheme } from "./ui/theme.js";
import { renderSettings, renderUsage } from "./ui/settings.js";
import {
  addParticipantRow,
  refreshLiveParticipants,
  readParticipantRows,
  participantRowCount,
  configureParticipants,
} from "./ui/participants.js";
import { showResults, hideResults, refreshResultsIfShown } from "./ui/results.js";
import { uiState } from "./ui/state.js";
import { subscribe as subscribeStats } from "./stats.js";

// Candidate cap scales down when transit participants are involved because
// Transitous has no matrix endpoint — total calls ≈ transit_count × candidates.
function candidateCap(transitCount) {
  if (transitCount === 0) return 20;
  return Math.min(20, Math.max(6, Math.floor(60 / transitCount)));
}

const $ = (sel) => document.querySelector(sel);
const statusEl = $("#status");
const findBtn = $("#find");

// ---- Init ----

initMap();
applyTheme(currentTheme());
applyI18n();
$("#lang-toggle").textContent = getLang() === "fr" ? "FR" : "EN";

configureParticipants({
  onStatus: ({ text, error }) => (error ? fail(text) : setStatus(text)),
});

renderSettings();
addParticipantRow("10 rue de Rivoli, Paris", "transit");
addParticipantRow("Place de la République, Paris", "transit");

$("#theme-toggle").addEventListener("click", toggleTheme);
$("#lang-toggle").addEventListener("click", () => {
  setLang(getLang() === "fr" ? "en" : "fr");
});

onLangChange((lang) => {
  // Labels that need translating are already tagged with data-i18n attributes;
  // applyI18n updates them in place, preserving focus on any active input.
  applyI18n();
  $("#lang-toggle").textContent = lang === "fr" ? "FR" : "EN";
  renderUsage();
  refreshLiveParticipants();
  refreshResultsIfShown();
});

subscribeStats(renderUsage);

$("#add-participant").addEventListener("click", () => addParticipantRow("", "transit"));
$("#n-results").addEventListener("input", (e) => {
  $("#n-results-val").textContent = e.target.value;
});
$("#radius").addEventListener("input", (e) => {
  $("#radius-val").textContent = e.target.value;
});
findBtn.addEventListener("click", run);

// ---- Main flow ----

async function run() {
  if (participantRowCount() < 2) return fail(t("errMinParticipants"));

  const rowData = readParticipantRows();
  if (rowData.some((r) => !r.coords && !r.address)) return fail(t("errAllAddresses"));

  const kinds = readPoiKinds();
  if (!kinds.length) return fail(t("errAtLeastOneKind"));

  for (const mode of new Set(rowData.map((r) => r.mode))) {
    const provider = getActiveRoutingProvider(mode);
    if (!provider) return fail(t("errNoProvider", { mode: t(`mode_${mode}`) }));
    if (provider.requiresKey && !getKey("routing", provider.id)) {
      return fail(t("errKeyRequired", { provider: provider.name, mode: t(`mode_${mode}`) }));
    }
  }

  const n = parseInt($("#n-results").value, 10);
  const radius = parseInt($("#radius").value, 10);

  findBtn.disabled = true;
  hideResults();
  statusEl.classList.remove("error");

  try {
    const addressesToGeocode = rowData.filter((r) => !r.coords).map((r) => r.address);

    let geocoded = [];
    if (addressesToGeocode.length) {
      setStatus(t("statusGeocoding"));
      geocoded = await geocodeAll(
        addressesToGeocode,
        (i, total, addr) => setStatus(t("statusGeocodingProgress", { i: i + 1, total, addr }))
      );
    }

    let gi = 0;
    const participants = rowData.map((r) => ({
      mode: r.mode,
      ...(r.coords ?? geocoded[gi++]),
    }));

    uiState.lastParticipants = participants;
    renderParticipants(participants);

    const center = barycenter(participants);

    setStatus(t("statusSearchingPOI"));
    const allPois = await fetchPOIs({ ...center, radiusMeters: radius, kinds });
    if (!allPois.length) throw new Error(t("errNoVenues"));

    const transitCount = participants.filter((p) => p.mode === "transit").length;
    const candidates = prefilterByDistance(allPois, center, candidateCap(transitCount));
    setStatus(t("statusFiltered", { total: allPois.length, kept: candidates.length }));

    const times = await computeTimes({
      participants,
      pois: candidates,
      onProgress: setStatus,
    });

    const ranked = rank({ pois: candidates, times, n });
    if (!ranked.length) throw new Error(t("errNoneReachable"));

    showResults(participants, ranked);
    setStatus(t("statusResults", { n: ranked.length, time: formatDuration(ranked[0].score) }));
  } catch (err) {
    console.error(err);
    fail(err.message);
  } finally {
    findBtn.disabled = false;
  }
}

function readPoiKinds() {
  return [...document.querySelectorAll("[data-poi-kind]")]
    .filter((el) => el.checked)
    .map((el) => el.dataset.poiKind);
}

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.classList.remove("error");
}

function fail(msg) {
  statusEl.textContent = msg;
  statusEl.classList.add("error");
}
