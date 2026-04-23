import {
  geocodeAll,
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
} from "./routing.js";
import { setProvider, setModeProvider, setKey, getKey } from "./config.js";
import { rank, formatDuration } from "./scoring.js";
import {
  initMap,
  renderParticipants,
  renderResults,
  fitToAll,
  focusPoi,
} from "./map.js";

const MAX_CANDIDATES = 12; // protects Transitous + ORS quota
const MODES = [
  { value: "transit", label: "Transports" },
  { value: "walk", label: "Marche" },
  { value: "bike", label: "Vélo" },
  { value: "car", label: "Voiture" },
];
const MODE_LABEL = Object.fromEntries(MODES.map((m) => [m.value, m.label]));

const $ = (sel) => document.querySelector(sel);
const participantsEl = $("#participants");
const statusEl = $("#status");
const resultsWrap = $("#results-wrap");
const resultsEl = $("#results");
const findBtn = $("#find");

// ---- Init ----

initMap();
renderSettings();
addParticipantRow("10 rue de Rivoli, Paris", "transit");
addParticipantRow("Place de la République, Paris", "transit");

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
    label: "Géocodage",
    providers: listGeocodingProviders(),
    activeId: getActiveGeocodingProvider().id,
    onChange: (id) => {
      setProvider("geocoding", id);
      renderSettings();
    },
  }));

  body.appendChild(providerSelect({
    label: "POI",
    providers: listPoiProviders(),
    activeId: getActivePoiProvider().id,
    onChange: (id) => {
      setProvider("pois", id);
      renderSettings();
    },
  }));

  const routingHeader = document.createElement("h3");
  routingHeader.textContent = "Routing (par mode)";
  body.appendChild(routingHeader);

  for (const mode of MODES.map((m) => m.value)) {
    body.appendChild(providerSelect({
      label: MODE_LABEL[mode],
      providers: providersForMode(mode),
      activeId: getActiveRoutingProvider(mode)?.id,
      onChange: (id) => {
        setModeProvider(mode, id);
        renderSettings();
      },
    }));
  }

  // Dedupe active providers that require a key (paired with their service).
  const activeEntries = [
    { service: "geocoding", provider: getActiveGeocodingProvider() },
    { service: "pois", provider: getActivePoiProvider() },
    ...MODES.map((m) => ({ service: "routing", provider: getActiveRoutingProvider(m.value) })),
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
    keysHeader.textContent = "Clés API";
    body.appendChild(keysHeader);
    for (const { service, provider } of unique) {
      body.appendChild(keyInput(service, provider));
    }
  }
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
    a.textContent = "Obtenir une clé ↗";
    labelEl.appendChild(a);
  }
  row.appendChild(labelEl);

  const input = document.createElement("input");
  input.type = "password";
  input.autocomplete = "off";
  input.placeholder = `Clé ${provider.name}`;
  input.value = getKey(service, provider.id);
  input.addEventListener("change", (e) => {
    setKey(service, provider.id, e.target.value.trim());
  });
  row.appendChild(input);

  return row;
}

// ---- Participant rows ----

function addParticipantRow(address = "", mode = "transit") {
  const row = document.createElement("div");
  row.className = "participant";
  row.innerHTML = `
    <input type="text" placeholder="Adresse" value="${escapeAttr(address)}" />
    <select>
      ${MODES.map((m) => `<option value="${m.value}" ${m.value === mode ? "selected" : ""}>${m.label}</option>`).join("")}
    </select>
    <button type="button" class="remove" title="Retirer">×</button>
  `;
  row.querySelector(".remove").addEventListener("click", () => {
    if (participantsEl.children.length <= 2) return;
    row.remove();
  });
  participantsEl.appendChild(row);
}

function readParticipants() {
  return [...participantsEl.children].map((row) => ({
    address: row.querySelector("input").value.trim(),
    mode: row.querySelector("select").value,
  }));
}

function readPoiKinds() {
  return [...document.querySelectorAll("[data-poi-kind]")]
    .filter((el) => el.checked)
    .map((el) => el.dataset.poiKind);
}

// ---- Main flow ----

async function run() {
  const inputs = readParticipants();
  if (inputs.length < 2) return fail("Au moins 2 participants.");
  if (inputs.some((p) => !p.address)) return fail("Toutes les adresses doivent être remplies.");

  const kinds = readPoiKinds();
  if (!kinds.length) return fail("Cocher au moins un type de lieu.");

  // Pre-flight: every mode in use needs an active provider with its key (if required).
  const usedModes = [...new Set(inputs.map((p) => p.mode))];
  for (const mode of usedModes) {
    const provider = getActiveRoutingProvider(mode);
    if (!provider) return fail(`Aucun provider configuré pour ${MODE_LABEL[mode]}.`);
    if (provider.requiresKey && !getKey("routing", provider.id)) {
      return fail(`Clé ${provider.name} requise (mode ${MODE_LABEL[mode]}).`);
    }
  }

  const n = parseInt($("#n-results").value, 10);
  const radius = parseInt($("#radius").value, 10);

  findBtn.disabled = true;
  resultsWrap.classList.add("hidden");
  statusEl.classList.remove("error");

  try {
    setStatus("Géocodage des adresses…");
    const coords = await geocodeAll(
      inputs.map((p) => p.address),
      (i, total, addr) => setStatus(`Géocodage ${i + 1}/${total} : ${addr}`)
    );
    const participants = inputs.map((p, i) => ({ ...p, ...coords[i] }));
    renderParticipants(participants);

    const center = barycenter(participants);

    setStatus("Recherche des bars/restos autour du barycentre…");
    const allPois = await fetchPOIs({ ...center, radiusMeters: radius, kinds });
    if (!allPois.length) throw new Error("Aucun lieu trouvé dans ce rayon.");

    const candidates = prefilterByDistance(allPois, center, MAX_CANDIDATES);
    setStatus(`${allPois.length} lieux → ${candidates.length} candidats à router.`);

    const times = await computeTimes({
      participants,
      pois: candidates,
      onProgress: setStatus,
    });

    const ranked = rank({ pois: candidates, times, n });
    if (!ranked.length) throw new Error("Aucun lieu joignable par tous les participants.");

    renderResults(ranked);
    renderResultsList(ranked);
    fitToAll(participants, ranked);
    setStatus(`${ranked.length} résultat(s). Meilleur : ${formatDuration(ranked[0].score)} max.`);
  } catch (err) {
    console.error(err);
    fail(err.message);
  } finally {
    findBtn.disabled = false;
  }
}

function renderResultsList(ranked) {
  resultsEl.innerHTML = ranked
    .map((r, i) => `
      <li data-idx="${i}">
        <span class="poi-name">${escapeHtml(r.poi.name)}</span>
        <div class="poi-meta">${r.poi.kind} · max <strong>${formatDuration(r.score)}</strong></div>
        <div class="poi-breakdown">${r.perParticipant
          .map((t, pi) => `P${pi + 1}: ${formatDuration(t)}`)
          .join(" · ")}</div>
      </li>
    `).join("");
  resultsEl.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", () => focusPoi(parseInt(li.dataset.idx, 10)));
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
