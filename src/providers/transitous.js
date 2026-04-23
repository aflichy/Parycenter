// Routing provider: Transitous (MOTIS 2). Public transit only. No key.
// Not a true matrix API — we call /plan per (source, destination) with bounded concurrency.

const PLAN = "https://api.transitous.org/api/v5/plan";
const CONCURRENCY = 2;

export const transitousProvider = {
  id: "transitous",
  name: "Transitous (MOTIS)",
  requiresKey: false,
  homepage: "https://transitous.org/",
  supportedModes: ["transit"],

  async computeMatrix({ sources, destinations, mode, onProgress }) {
    if (mode !== "transit") throw new Error(`Transitous: unsupported mode ${mode}`);

    const m = destinations.length;
    const matrix = sources.map(() => Array(m).fill(null));
    const jobs = [];
    for (let i = 0; i < sources.length; i++) {
      for (let j = 0; j < destinations.length; j++) {
        jobs.push({ i, j });
      }
    }

    let done = 0;
    const total = jobs.length;

    async function worker() {
      while (jobs.length) {
        const job = jobs.shift();
        if (!job) return;
        matrix[job.i][job.j] = await plan(sources[job.i], destinations[job.j]);
        done++;
        onProgress?.(`Transit routing: ${done}/${total}`);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, total) }, worker)
    );
    return matrix;
  },
};

async function plan(from, to) {
  const url = new URL(PLAN);
  url.searchParams.set("fromPlace", `${from.lat},${from.lon}`);
  url.searchParams.set("toPlace", `${to.lat},${to.lon}`);
  url.searchParams.set("arriveBy", "false");
  url.searchParams.set("directModes", "WALK");
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const itins = data.itineraries ?? [];
    if (itins.length) return Math.min(...itins.map((it) => it.duration));
    const direct = data.direct?.[0]?.duration;
    return typeof direct === "number" ? direct : null;
  } catch {
    return null;
  }
}
