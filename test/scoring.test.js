import { test } from "node:test";
import assert from "node:assert/strict";
import { rank, formatDuration } from "../src/scoring.js";

test("rank: drops POIs unreachable by any participant", () => {
  const pois = [{ name: "A" }, { name: "B" }];
  const times = [
    [300, null],  // P0: A reachable, B not
    [200, 100],   // P1: both reachable
  ];
  const result = rank({ pois, times, n: 5 });
  assert.equal(result.length, 1);
  assert.equal(result[0].poi.name, "A");
});

test("rank: sorts by max travel time ascending (fairness criterion)", () => {
  const pois = [{ name: "X" }, { name: "Y" }, { name: "Z" }];
  const times = [
    [600, 300, 900], // P0
    [100, 500, 200], // P1
  ];
  // Max per POI: X=600, Y=500, Z=900 → order Y, X, Z
  const result = rank({ pois, times, n: 10 });
  assert.deepEqual(result.map((r) => r.poi.name), ["Y", "X", "Z"]);
  assert.deepEqual(result.map((r) => r.score), [500, 600, 900]);
});

test("rank: respects n cap", () => {
  const pois = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}` }));
  const times = [[60, 120, 180, 240, 300]];
  const result = rank({ pois, times, n: 2 });
  assert.equal(result.length, 2);
  assert.equal(result[0].poi.name, "P0");
});

test("rank: treats Infinity as unreachable", () => {
  const pois = [{ name: "A" }];
  const times = [[Infinity]];
  assert.equal(rank({ pois, times, n: 5 }).length, 0);
});

test("rank: includes per-participant breakdown", () => {
  const pois = [{ name: "A" }];
  const times = [[100], [200], [300]];
  const result = rank({ pois, times, n: 5 });
  assert.deepEqual(result[0].perParticipant, [100, 200, 300]);
  assert.equal(result[0].score, 300);
});

test("formatDuration: minutes under an hour", () => {
  assert.equal(formatDuration(0), "0 min");
  assert.equal(formatDuration(59), "1 min");
  assert.equal(formatDuration(120), "2 min");
  assert.equal(formatDuration(3540), "59 min");
});

test("formatDuration: near-hour rounds up to full hour", () => {
  // 3599 / 60 = 59.98 → rounds to 60 → "1h"
  assert.equal(formatDuration(3599), "1h");
});

test("formatDuration: exact hours", () => {
  assert.equal(formatDuration(3600), "1h");
  assert.equal(formatDuration(7200), "2h");
});

test("formatDuration: hours + minutes with leading zero", () => {
  assert.equal(formatDuration(3660), "1h01");
  assert.equal(formatDuration(5400), "1h30");
  assert.equal(formatDuration(7260), "2h01");
});
