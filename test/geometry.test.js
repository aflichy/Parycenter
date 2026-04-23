import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineMeters, prefilterByDistance, barycenter } from "../src/geometry.js";

test("barycenter: arithmetic mean of coordinates", () => {
  const c = barycenter([
    { lat: 0, lon: 0 },
    { lat: 10, lon: 10 },
  ]);
  assert.equal(c.lat, 5);
  assert.equal(c.lon, 5);
});

test("barycenter: four points", () => {
  const c = barycenter([
    { lat: 48.86, lon: 2.35 },
    { lat: 48.88, lon: 2.37 },
    { lat: 48.84, lon: 2.33 },
    { lat: 48.86, lon: 2.35 },
  ]);
  assert.ok(Math.abs(c.lat - 48.86) < 0.01);
  assert.ok(Math.abs(c.lon - 2.35) < 0.01);
});

test("barycenter: throws on empty input", () => {
  assert.throws(() => barycenter([]));
});

test("haversineMeters: zero for same point", () => {
  const p = { lat: 48.8566, lon: 2.3522 };
  assert.equal(haversineMeters(p, p), 0);
});

test("haversineMeters: Paris → Lyon is ≈392 km (±5 km)", () => {
  const paris = { lat: 48.8566, lon: 2.3522 };
  const lyon = { lat: 45.764, lon: 4.8357 };
  const d = haversineMeters(paris, lyon);
  assert.ok(d > 387000 && d < 397000, `expected ~392000m, got ${d}`);
});

test("haversineMeters: symmetric", () => {
  const a = { lat: 40, lon: -74 };
  const b = { lat: 34, lon: -118 };
  assert.equal(haversineMeters(a, b), haversineMeters(b, a));
});

test("prefilterByDistance: keeps the N closest POIs", () => {
  const center = { lat: 0, lon: 0 };
  const pois = [
    { id: "far",     lat: 0, lon: 10 },
    { id: "close",   lat: 0, lon: 0.1 },
    { id: "mid",     lat: 0, lon: 5 },
    { id: "closest", lat: 0, lon: 0.05 },
  ];
  const result = prefilterByDistance(pois, center, 2);
  assert.deepEqual(result.map((p) => p.id), ["closest", "close"]);
});

test("prefilterByDistance: preserves original POI fields", () => {
  const result = prefilterByDistance(
    [{ id: "x", name: "Bar X", lat: 0, lon: 0, extra: 42 }],
    { lat: 0, lon: 0 },
    10
  );
  assert.deepEqual(result, [{ id: "x", name: "Bar X", lat: 0, lon: 0, extra: 42 }]);
});

test("prefilterByDistance: max greater than input length returns all", () => {
  const pois = [{ id: "a", lat: 0, lon: 0 }, { id: "b", lat: 1, lon: 1 }];
  const result = prefilterByDistance(pois, { lat: 0, lon: 0 }, 10);
  assert.equal(result.length, 2);
});
