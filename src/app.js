import {
  geocodeAll,
  autocomplete,
  reverseGeocode,
  listGeocodingProviders,
  getActiveGeocodingProvider,
} from "./geocoding.js";
import {
  fetchPOIs,
  listPoiProviders,
  getActivePoiProvider,
} from "./pois.js";
import { prefilterByDistance, barycenter } from "./geometry.js";
import {
  computeTimes,
  providersForMode,
  getActiveRoutingProvider,
  listRoutingProviders,
} from "./routing.js";
import { get as getStats, subscribe as subscribeStats } from "./stats.js";
import { setProvider, setModeProvider, setKey, getKey } from "./config.js";
import { rank, formatDuration } from "./scoring.js";
import {
  initMap,
  setMapTheme,
  renderParticipants,
  renderResults,
  fitToAll,
  focusPoi,
} from "./map.js";
import { t, getLang, setLang, onLangChange, applyI18n } from "./i18n.js";
import { googleMapsUrl, escapeHtml } from "./util.js";

const MODE_VALUES = ["transit", "walk", "bike", "car"];

// Candidate cap scales down when transit participants are involved, because
// Transitous has no matrix endpoint — total calls ≈ transit_count × candidates.
function candidateCap(transitCount) {
  if (transitCount === 0) return 20;
  return Math.min(20, Math.max(6, Math.floor(60 / transitCount)));
}
const AUTOCOMPLETE_MIN_CHARS = 3;
const AUTOCOMPLETE_DEBOUNCE_MS = 400;

const $ = (sel) => document.querySelector(sel);
const participantsEl = $("#participants");
const statusEl = $("#status");
const resultsWrap = $("#results-wrap");
const resultsEl = $("#results");
const findBtn = $("#find");

// Last ranked results / participants kept in memory so we can re-render on lang change.
let lastRanked = null;
let lastParticipants = [];

// ---- Theme ----

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme, persist = false) {
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem("parycenter-theme", theme);
  setMapTheme(theme);
  $("#theme-toggle").textContent = theme === "dark" ? "☀" : "🌙";
}

// ---- Init ----

initMap();
applyTheme(currentTheme());
applyI18n();
$("#lang-toggle").textContent = getLang() === "fr" ? "FR" : "EN";

renderSettings();
addParticipantRow("10 rue de Rivoli, Paris", "transit");
addParticipantRow("Place de la République, Paris", "transit");

$("#theme-toggle").addEventListener("click", () => {
  applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
});

$("#lang-toggle").addEventListener("click", () => {
  setLang(getLang() === "fr" ? "en" : "fr");
});

onLangChange((lang) => {
  applyI18n();
  $("#lang-toggle").textContent = lang === "fr" ? "FR" : "EN";
  renderSettings();
  if (lastParticipants.length) renderParticipants(lastParticipants);
  if (lastRanked) {
    renderResults(lastRanked);
    renderResultsList(lastRanked);
  }
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

// ---- Settings panel ----

function renderSettings() {
  const body = $("#settings-body");
  body.innerHTML = "";

  body.appendChild(providerSelect({
    label: t("geocoding"),
    providers: listGeocodingProviders(),
    activeId: getActiveGeocodingProvider().id,
    onChange: (id) => {
      setProvider("geocoding", id);
      renderSettings();
    },
  }));

  body.appendChild(providerSelect({
    label: t("poi"),
    providers: listPoiProviders(),
    activeId: getActivePoiProvider().id,
    onChange: (id) => {
      setProvider("pois", id);
      renderSettings();
    },
  }));

  const routingHeader = document.createElement("h3");
  routingHeader.textContent = t("routingPerMode");
  body.appendChild(routingHeader);

  for (const mode of MODE_VALUES) {
    body.appendChild(providerSelect({
      label: t(`mode_${mode}`),
      providers: providersForMode(mode),
      activeId: getActiveRoutingProvider(mode)?.id,
      onChange: (id) => {
        setModeProvider(mode, id);
        renderSettings();
      },
    }));
  }

  // Dedupe active providers that require a key (paired with their owning service).
  const activeEntries = [
    { service: "geocoding", provider: getActiveGeocodingProvider() },
    { service: "pois", provider: getActivePoiProvider() },
    ...MODE_VALUES.map((m) => ({ service: "routing", provider: getActiveRoutingProvider(m) })),
  ].filter((e) => e.provider?.requiresKey);

  const unique = [];
  const seen = new Set();
  for (const e of activeEntries) {
    if (!seen.has(e.provider.id)) {
      seen.add(e.provider.id);
      unique.push(e);
    }
  }

  if (unique.length) {
    const keysHeader = document.createElement("h3");
    keysHeader.textContent = t("apiKeys");
    body.appendChild(keysHeader);
    for (const { service, provider } of unique) {
      body.appendChild(keyInput(service, provider));
    }
  }

  const usageWrap = document.createElement("div");
  usageWrap.id = "usage-section";
  body.appendChild(usageWrap);
  renderUsage();
}

function renderUsage() {
  const wrap = $("#usage-section");
  if (!wrap) return;

  const allProviders = [
    ...listGeocodingProviders(),
    ...listPoiProviders(),
    ...listRoutingProviders(),
  ];
  // Dedupe by id (ORS appears in multiple mode slots).
  const seen = new Set();
  const withStats = [];
  for (const p of allProviders) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const s = getStats(p.id);
    if (s && s.calls > 0) withStats.push({ provider: p, stats: s });
  }

  if (!withStats.length) {
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = `
    <h3>${escapeHtml(t("usage"))}</h3>
    ${withStats.map(({ provider, stats }) => {
      const cls = stats.rateLimited ? "rate-limited" : stats.errors ? "has-errors" : "";
      const suffix = stats.rateLimited
        ? ` · ${t("usageRateLimited")}`
        : stats.errors
          ? ` · ${t("usageErrors", { n: stats.errors })}`
          : "";
      return `
        <div class="usage-row ${cls}" title="${escapeHtml(stats.lastError ?? "")}">
          <span class="name">${escapeHtml(provider.name)}</span>
          <span class="counts">${t("usageCalls", { n: stats.calls })}${suffix}</span>
        </div>
      `;
    }).join("")}
  `;
}

function providerSelect({ label, providers, activeId, onChange }) {
  const row = document.createElement("div");
  row.className = "setting-row";

  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const select = document.createElement("select");
  select.disabled = providers.length <= 1;
  providers.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === activeId) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener("change", (e) => onChange(e.target.value));
  row.appendChild(select);

  return row;
}

function keyInput(service, provider) {
  const row = document.createElement("div");
  row.className = "key-row";

  const labelEl = document.createElement("div");
  labelEl.className = "key-label";
  const nameSpan = document.createElement("span");
  nameSpan.textContent = provider.name;
  labelEl.appendChild(nameSpan);
  if (provider.signupUrl) {
    const a = document.createElement("a");
    a.href = provider.signupUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = t("getKey");
    labelEl.appendChild(a);
  }
  row.appendChild(labelEl);

  const input = document.createElement("input");
  input.type = "password";
  input.autocomplete = "off";
  input.placeholder = t("providerKeyPlaceholder", { provider: provider.name });
  input.value = getKey(service, provider.id);
  input.addEventListener("change", (e) => {
    setKey(service, provider.id, e.target.value.trim());
  });
  row.appendChild(input);

  return row;
}

// ---- Participant rows ----

function addParticipantRow(address = "", mode = "transit") {
  const isFirst = participantsEl.children.length === 0;
  const row = document.createElement("div");
  row.className = "participant";

  const modeOptions = MODE_VALUES
    .map((v) => `<option value="${v}" data-i18n="mode_${v}" ${v === mode ? "selected" : ""}></option>`)
    .join("");

  row.innerHTML = `
    <div class="address-field">
      <input type="text" autocomplete="off" data-i18n-placeholder="addressPlaceholder" value="${escapeHtml(address)}" />
      ${isFirst ? '<button type="button" class="geolocate" data-i18n-title="useMyLocation">📍</button>' : ""}
      <ul class="ac-dropdown hidden"></ul>
    </div>
    <select>${modeOptions}</select>
    <button type="button" class="remove" data-i18n-title="remove">×</button>
  `;

  const input = row.querySelector(".address-field input");
  const dropdown = row.querySelector(".ac-dropdown");
  const select = row.querySelector("select");

  attachAutocomplete(input, dropdown, row);
  row.querySelector(".geolocate")?.addEventListener("click", () => geolocateRow(row));
  select.addEventListener("change", renderLiveParticipants);
  row.querySelector(".remove").addEventListener("click", () => {
    if (participantsEl.children.length <= 2) return;
    row.remove();
    renderLiveParticipants();
  });

  participantsEl.appendChild(row);
  applyI18n(row);
}

function attachAutocomplete(input, dropdown, row) {
  let debounceTimer;
  let controller = null;
  let results = [];
  let activeIdx = -1;

  input.addEventListener("input", () => {
    clearRowCoords(row);
    renderLiveParticipants();

    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (q.length < AUTOCOMPLETE_MIN_CHARS) {
      closeDropdown();
      return;
    }
    debounceTimer = setTimeout(async () => {
      if (controller) controller.abort();
      controller = new AbortController();
      try {
        results = await autocomplete(q, { signal: controller.signal });
        activeIdx = -1;
        renderDropdown();
      } catch (e) {
        if (e.name !== "AbortError") console.error(e);
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  });

  input.addEventListener("keydown", (e) => {
    if (dropdown.classList.contains("hidden") || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = (activeIdx + 1) % results.length;
      highlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = (activeIdx - 1 + results.length) % results.length;
      highlight();
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      select(results[activeIdx]);
    } else if (e.key === "Escape") {
      closeDropdown();
    }
  });

  input.addEventListener("blur", () => setTimeout(closeDropdown, 150));

  function renderDropdown() {
    if (!results.length) { closeDropdown(); return; }
    dropdown.innerHTML = results
      .map((r, i) => `<li data-idx="${i}">${escapeHtml(r.displayName)}</li>`)
      .join("");
    dropdown.classList.remove("hidden");
    dropdown.querySelectorAll("li").forEach((li) => {
      li.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep focus / prevent input blur before we read .value
        select(results[parseInt(li.dataset.idx, 10)]);
      });
    });
  }

  function highlight() {
    dropdown.querySelectorAll("li").forEach((li, i) =>
      li.classList.toggle("active", i === activeIdx)
    );
  }

  function select(result) {
    input.value = result.displayName;
    setRowCoords(row, result);
    closeDropdown();
    renderLiveParticipants();
  }

  function closeDropdown() {
    dropdown.classList.add("hidden");
    dropdown.innerHTML = "";
    activeIdx = -1;
  }
}

async function geolocateRow(row) {
  const button = row.querySelector(".geolocate");
  const input = row.querySelector(".address-field input");
  if (!navigator.geolocation) return fail(t("errGeoNotAvailable"));
  button.disabled = true;
  button.textContent = "⏳";
  setStatus(t("statusDetectingLocation"));
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
      });
    });
    const { latitude: lat, longitude: lon } = pos.coords;
    setStatus(t("statusReverseGeocoding"));
    const result = await reverseGeocode(lat, lon);
    input.value = result.displayName;
    setRowCoords(row, result);
    renderLiveParticipants();
    setStatus("");
  } catch (err) {
    fail(err.message ?? String(err));
  } finally {
    button.disabled = false;
    button.textContent = "📍";
  }
}

function clearRowCoords(row) {
  delete row.dataset.lat;
  delete row.dataset.lon;
  delete row.dataset.displayName;
}

function setRowCoords(row, { lat, lon, displayName }) {
  row.dataset.lat = String(lat);
  row.dataset.lon = String(lon);
  row.dataset.displayName = displayName ?? "";
}

function getRowCoords(row) {
  if (!row.dataset.lat || !row.dataset.lon) return null;
  return {
    lat: parseFloat(row.dataset.lat),
    lon: parseFloat(row.dataset.lon),
    displayName: row.dataset.displayName ?? "",
  };
}

function renderLiveParticipants() {
  lastParticipants = [...participantsEl.children]
    .map((row) => {
      const coords = getRowCoords(row);
      if (!coords) return null;
      return { ...coords, mode: row.querySelector("select").value };
    })
    .filter(Boolean);
  renderParticipants(lastParticipants);
}

function readPoiKinds() {
  return [...document.querySelectorAll("[data-poi-kind]")]
    .filter((el) => el.checked)
    .map((el) => el.dataset.poiKind);
}

// ---- Main flow ----

async function run() {
  const rows = [...participantsEl.children];
  if (rows.length < 2) return fail(t("errMinParticipants"));

  const rowData = rows.map((row) => ({
    address: row.querySelector(".address-field input").value.trim(),
    mode: row.querySelector("select").value,
    coords: getRowCoords(row),
  }));

  if (rowData.some((r) => !r.coords && !r.address)) return fail(t("errAllAddresses"));

  const kinds = readPoiKinds();
  if (!kinds.length) return fail(t("errAtLeastOneKind"));

  const usedModes = [...new Set(rowData.map((r) => r.mode))];
  for (const mode of usedModes) {
    const provider = getActiveRoutingProvider(mode);
    if (!provider) return fail(t("errNoProvider", { mode: t(`mode_${mode}`) }));
    if (provider.requiresKey && !getKey("routing", provider.id)) {
      return fail(t("errKeyRequired", { provider: provider.name, mode: t(`mode_${mode}`) }));
    }
  }

  const n = parseInt($("#n-results").value, 10);
  const radius = parseInt($("#radius").value, 10);

  findBtn.disabled = true;
  resultsWrap.classList.add("hidden");
  statusEl.classList.remove("error");

  try {
    // Geocode only rows without confirmed coords, then merge back in row order.
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

    lastParticipants = participants;
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

    lastRanked = ranked;
    renderResults(ranked);
    renderResultsList(ranked);
    fitToAll(participants, ranked);
    setStatus(t("statusResults", { n: ranked.length, time: formatDuration(ranked[0].score) }));
  } catch (err) {
    console.error(err);
    fail(err.message);
  } finally {
    findBtn.disabled = false;
  }
}

function renderResultsList(ranked) {
  resultsEl.innerHTML = ranked
    .map((r, i) => {
      const gmaps = googleMapsUrl(r.poi);
      const breakdown = r.perParticipant
        .map((tt, pi) => `P${pi + 1}: ${formatDuration(tt)}`)
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
      if (e.target.closest("a")) return; // let Google Maps link through
      focusPoi(parseInt(li.dataset.idx, 10));
    });
  });
  resultsWrap.classList.remove("hidden");
}

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.classList.remove("error");
}

function fail(msg) {
  statusEl.textContent = msg;
  statusEl.classList.add("error");
}

