// Session-scoped per-provider call counters. Observers re-render on change.

const state = new Map(); // providerId → { calls, errors, rateLimited, lastCallAt, lastError }
const listeners = new Set();

function ensure(id) {
  let s = state.get(id);
  if (!s) {
    s = { calls: 0, errors: 0, rateLimited: 0, lastCallAt: 0, lastError: null };
    state.set(id, s);
  }
  return s;
}

function record(id, { error, rateLimited } = {}) {
  const s = ensure(id);
  s.calls++;
  s.lastCallAt = Date.now();
  if (rateLimited) s.rateLimited++;
  if (error) {
    s.errors++;
    s.lastError = error;
  }
  notify();
}

export function get(id) {
  return state.get(id) ?? null;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

// Wraps fetch: records one call per attempt, flags 429 as rateLimited.
// Aborted requests (AbortError) are not recorded — they're user-driven.
export async function trackedFetch(providerId, input, init) {
  try {
    const res = await fetch(input, init);
    if (res.status === 429) {
      record(providerId, { error: "HTTP 429 (rate limited)", rateLimited: true });
    } else if (!res.ok) {
      record(providerId, { error: `HTTP ${res.status}` });
    } else {
      record(providerId);
    }
    return res;
  } catch (e) {
    if (e.name !== "AbortError") record(providerId, { error: e.message });
    throw e;
  }
}
