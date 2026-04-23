// score(poi) = max(time[participant -> poi]) across all participants.
// POIs with any unreachable participant are dropped.

export function rank({ pois, times, n }) {
  const ranked = pois
    .map((poi, j) => {
      const col = times.map((row) => row[j]);
      const reachable = col.every((t) => typeof t === "number" && isFinite(t));
      if (!reachable) return null;
      return {
        poi,
        perParticipant: col,
        score: Math.max(...col),
      };
    })
    .filter(Boolean);
  ranked.sort((a, b) => a.score - b.score);
  return ranked.slice(0, n);
}

export function formatDuration(seconds) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h${String(rem).padStart(2, "0")}` : `${h}h`;
}
