import { t, applyI18n } from "../i18n.js";
import { listGeocodingProviders, getActiveGeocodingProvider } from "../geocoding.js";
import { listPoiProviders, getActivePoiProvider } from "../pois.js";
import {
  providersForMode,
  getActiveRoutingProvider,
  listRoutingProviders,
} from "../routing.js";
import { setProvider, setModeProvider, setKey, getKey } from "../config.js";
import { get as getStats } from "../stats.js";
import { escapeHtml } from "../util.js";

const MODE_VALUES = ["transit", "walk", "bike", "car"];
const body = document.getElementById("settings-body");

export function renderSettings() {
  body.innerHTML = "";

  body.appendChild(providerSelect({
    i18nKey: "geocoding",
    providers: listGeocodingProviders(),
    activeId: getActiveGeocodingProvider().id,
    onChange: (id) => {
      setProvider("geocoding", id);
      renderSettings();
    },
  }));

  body.appendChild(providerSelect({
    i18nKey: "poi",
    providers: listPoiProviders(),
    activeId: getActivePoiProvider().id,
    onChange: (id) => {
      setProvider("pois", id);
      renderSettings();
    },
  }));

  body.appendChild(i18nHeader("routingPerMode"));

  for (const mode of MODE_VALUES) {
    body.appendChild(providerSelect({
      i18nKey: `mode_${mode}`,
      providers: providersForMode(mode),
      activeId: getActiveRoutingProvider(mode)?.id,
      onChange: (id) => {
        setModeProvider(mode, id);
        renderSettings();
      },
    }));
  }

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
    body.appendChild(i18nHeader("apiKeys"));
    for (const { service, provider } of unique) {
      body.appendChild(keyInput(service, provider));
    }
  }

  const usageWrap = document.createElement("div");
  usageWrap.id = "usage-section";
  body.appendChild(usageWrap);
  renderUsage();

  applyI18n(body);
}

export function renderUsage() {
  const wrap = document.getElementById("usage-section");
  if (!wrap) return;

  const allProviders = [
    ...listGeocodingProviders(),
    ...listPoiProviders(),
    ...listRoutingProviders(),
  ];
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
    <h3 data-i18n="usage">${escapeHtml(t("usage"))}</h3>
    ${withStats.map(({ provider, stats }) => {
      const cls = stats.rateLimited ? "rate-limited" : stats.errors ? "has-errors" : "";
      const suffix = stats.rateLimited
        ? ` · ${escapeHtml(t("usageRateLimited"))}`
        : stats.errors
          ? ` · ${escapeHtml(t("usageErrors", { n: stats.errors }))}`
          : "";
      return `
        <div class="usage-row ${cls}" title="${escapeHtml(stats.lastError ?? "")}">
          <span class="name">${escapeHtml(provider.name)}</span>
          <span class="counts">${escapeHtml(t("usageCalls", { n: stats.calls }))}${suffix}</span>
        </div>
      `;
    }).join("")}
  `;
}

function i18nHeader(key) {
  const h = document.createElement("h3");
  h.dataset.i18n = key;
  h.textContent = t(key);
  return h;
}

function providerSelect({ i18nKey, providers, activeId, onChange }) {
  const row = document.createElement("div");
  row.className = "setting-row";

  const labelEl = document.createElement("label");
  labelEl.dataset.i18n = i18nKey;
  labelEl.textContent = t(i18nKey);
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
    a.dataset.i18n = "getKey";
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
