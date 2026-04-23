import { autocomplete, reverseGeocode } from "../geocoding.js";
import { renderParticipants as renderMapParticipants } from "../map.js";
import { applyI18n, t, localizeError } from "../i18n.js";
import { escapeHtml } from "../util.js";
import { uiState } from "./state.js";

const MODE_VALUES = ["transit", "walk", "bike", "car"];
const AUTOCOMPLETE_MIN_CHARS = 3;
const AUTOCOMPLETE_DEBOUNCE_MS = 400;

const participantsEl = document.getElementById("participants");
const scrollContainer = document.getElementById("panel");
let nextDropdownSeq = 1;

let statusCallback = () => {};

export function configureParticipants({ onStatus }) {
  statusCallback = onStatus ?? (() => {});
}

export function addParticipantRow(address = "", mode = "transit") {
  const row = document.createElement("div");
  row.className = "participant";

  const modeOptions = MODE_VALUES
    .map((v) => `<option value="${v}" data-i18n="mode_${v}" ${v === mode ? "selected" : ""}></option>`)
    .join("");

  // The 📍 button is rendered on every row; CSS hides it on non-first rows, so
  // if the user removes the current first row, the next one gets it for free.
  row.innerHTML = `
    <div class="address-field">
      <input type="text" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false"
             data-i18n-placeholder="addressPlaceholder" value="${escapeHtml(address)}" />
      <button type="button" class="geolocate" data-i18n-title="useMyLocation">📍</button>
    </div>
    <select>${modeOptions}</select>
    <button type="button" class="remove" data-i18n-title="remove">×</button>
  `;

  const input = row.querySelector(".address-field input");
  const select = row.querySelector("select");

  attachAutocomplete(input, row);
  row.querySelector(".geolocate").addEventListener("click", () => geolocateRow(row));
  select.addEventListener("change", renderLiveParticipants);
  row.querySelector(".remove").addEventListener("click", () => {
    if (participantsEl.children.length <= 2) return;
    row._cleanupAutocomplete?.();
    row.remove();
    renderLiveParticipants();
  });

  participantsEl.appendChild(row);
  applyI18n(row);
}

function attachAutocomplete(input, row) {
  // Dropdown is portaled to <body> so it's not clipped by the sidebar's
  // overflow-y: auto. Positioned with position: fixed under the input.
  const dropdown = document.createElement("ul");
  const dropdownId = `ac-dropdown-${nextDropdownSeq++}`;
  dropdown.id = dropdownId;
  dropdown.className = "ac-dropdown hidden";
  dropdown.setAttribute("role", "listbox");
  document.body.appendChild(dropdown);

  input.setAttribute("aria-controls", dropdownId);

  let debounceTimer;
  let controller = null;
  let results = [];
  let activeIdx = -1;

  function positionDropdown() {
    const rect = input.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 2}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.width = `${rect.width}px`;
  }

  function openDropdown() {
    positionDropdown();
    dropdown.classList.remove("hidden");
    input.setAttribute("aria-expanded", "true");
  }

  function closeDropdown() {
    dropdown.classList.add("hidden");
    dropdown.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIdx = -1;
  }

  function renderDropdown() {
    if (!results.length) { closeDropdown(); return; }
    dropdown.innerHTML = results
      .map((r, i) => `<li role="option" id="${dropdownId}-opt-${i}" data-idx="${i}">${escapeHtml(r.displayName)}</li>`)
      .join("");
    openDropdown();
    dropdown.querySelectorAll("li").forEach((li) => {
      li.addEventListener("mousedown", (e) => {
        e.preventDefault(); // don't blur input before we can read its value
        select(results[parseInt(li.dataset.idx, 10)]);
      });
    });
  }

  function highlight() {
    dropdown.querySelectorAll("li").forEach((li, i) => {
      const active = i === activeIdx;
      li.classList.toggle("active", active);
      li.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (activeIdx >= 0) {
      input.setAttribute("aria-activedescendant", `${dropdownId}-opt-${activeIdx}`);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function select(result) {
    input.value = result.displayName;
    setRowCoords(row, result);
    closeDropdown();
    renderLiveParticipants();
  }

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

  // Close on scroll or resize — simpler than repositioning and avoids drift.
  const onScroll = () => closeDropdown();
  const onResize = () => closeDropdown();
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  scrollContainer?.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  row._cleanupAutocomplete = () => {
    window.removeEventListener("scroll", onScroll, { capture: true });
    scrollContainer?.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    dropdown.remove();
  };
}

async function geolocateRow(row) {
  const button = row.querySelector(".geolocate");
  const input = row.querySelector(".address-field input");
  if (!navigator.geolocation) {
    statusCallback({ text: t("errGeoNotAvailable"), error: true });
    return;
  }
  button.disabled = true;
  button.textContent = "⏳";
  statusCallback({ text: t("statusDetectingLocation") });
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
      });
    });
    const { latitude: lat, longitude: lon } = pos.coords;
    statusCallback({ text: t("statusReverseGeocoding") });
    const result = await reverseGeocode(lat, lon);
    input.value = result.displayName;
    setRowCoords(row, result);
    renderLiveParticipants();
    statusCallback({ text: "" });
  } catch (err) {
    statusCallback({ text: localizeError(err), error: true });
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

export function renderLiveParticipants() {
  uiState.lastParticipants = [...participantsEl.children]
    .map((row) => {
      const coords = getRowCoords(row);
      if (!coords) return null;
      return { ...coords, mode: row.querySelector("select").value };
    })
    .filter(Boolean);
  renderMapParticipants(uiState.lastParticipants);
}

export function refreshLiveParticipants() {
  if (uiState.lastParticipants.length) renderMapParticipants(uiState.lastParticipants);
}

export function readParticipantRows() {
  return [...participantsEl.children].map((row) => ({
    address: row.querySelector(".address-field input").value.trim(),
    mode: row.querySelector("select").value,
    coords: getRowCoords(row),
  }));
}

export function participantRowCount() {
  return participantsEl.children.length;
}
