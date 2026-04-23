import { setMapTheme } from "../map.js";

const STORAGE_KEY = "parycenter-theme";

export function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme, persist = false) {
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem(STORAGE_KEY, theme);
  setMapTheme(theme);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = theme === "dark" ? "☀" : "🌙";
}

export function toggleTheme() {
  applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
}
