import { formatDuration } from "../scoring.js";
import { renderResults as renderMapResults, fitToAll, focusPoi } from "../map.js";
import { t } from "../i18n.js";
import { googleMapsUrl, escapeHtml } from "../util.js";
import { uiState } from "./state.js";

const resultsWrap = document.getElementById("results-wrap");
const resultsEl = document.getElementById("results");

export function showResults(participants, ranked) {
  uiState.lastRanked = ranked;
  renderMapResults(ranked);
  renderResultsList(ranked);
  fitToAll(participants, ranked);
}

export function renderResultsList(ranked) {
  resultsEl.innerHTML = ranked
    .map((r, i) => {
      const gmaps = googleMapsUrl(r.poi);
      const breakdown = r.perParticipant
        .map((secs, pi) => `P${pi + 1}: ${formatDuration(secs)}`)
        .join(" · ");
      return `
        <li data-idx="${i}">
          <div class="poi-header">
            <span class="poi-name">${escapeHtml(r.poi.name)}</span>
            <a class="gmaps" href="${gmaps}" target="_blank" rel="noopener">${t("openInGoogleMaps")}</a>
          </div>
          <div class="poi-meta">${escapeHtml(r.poi.kind)} · ${t("maxLabel")} <strong>${formatDuration(r.score)}</strong></div>
          <div class="poi-breakdown">${breakdown}</div>
        </li>`;
    })
    .join("");
  resultsEl.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      focusPoi(parseInt(li.dataset.idx, 10));
    });
  });
  resultsWrap.classList.remove("hidden");
}

export function hideResults() {
  resultsWrap.classList.add("hidden");
}

export function refreshResultsIfShown() {
  if (uiState.lastRanked) {
    renderMapResults(uiState.lastRanked);
    renderResultsList(uiState.lastRanked);
  }
}
