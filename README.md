# Parycenter 🍺

**Live at → https://aflichy.github.io/Parycenter/**

Find the bar or restaurant that **minimizes the maximum travel time** across a group — each person with their own transport mode (walk, bike, car, or public transit).

Fairness criterion: the winning spot is the one where **the worst-off person arrives fastest**.

## Run locally

Static site, no build step. Serve with any static file server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

or:

```sh
npm run serve
```

On first run, expand **⚙ Service configuration** in the sidebar and paste your OpenRouteService key (required for walk / bike / car). Public transit needs no key.

## Deploy on GitHub Pages

Zero config — all paths are relative. Two options:

1. **Settings tab** (simplest): repo → *Settings* → *Pages* → *Source: Deploy from a branch* → *Branch: `main` / `/` (root)* → Save.
2. **CLI** (one-liner):
   ```sh
   gh api -X POST repos/<user>/<repo>/pages \
     -f build_type=legacy -f source[branch]=main -f source[path]=/
   ```

The site ends up at `https://<user>.github.io/<repo>/`.

## External services

Every external service is pluggable behind a provider contract. Defaults:

| Service | Default provider | Key |
|---|---|---|
| Geocoding | Nominatim (OSM) | — |
| POIs (bars, restaurants) | Overpass (OSM) | — |
| Routing — walk / bike / car | OpenRouteService | required ([sign up](https://openrouteservice.org/dev/#/signup)) |
| Routing — public transit | Transitous (MOTIS) | — |

Provider selections and API keys are stored in the browser's `localStorage` (never sent anywhere else).

## Architecture

```
src/
├── app.js            ← UI controller
├── map.js            ← Leaflet rendering
├── config.js         ← active provider + keys, persisted in localStorage
├── geocoding.js      ← service: dispatches to active provider
├── pois.js           ← same pattern
├── routing.js        ← same, groups participants by mode
├── scoring.js        ← ranking (max-time aggregation)
├── geometry.js       ← Haversine, barycenter, distance prefilter
└── providers/
    ├── nominatim.js         (geocoding)
    ├── overpass.js          (POIs)
    ├── openrouteservice.js  (road routing)
    └── transitous.js        (transit routing)
```

### Adding a provider

1. Create `src/providers/<name>.js` exporting an object matching the service contract (see existing providers for examples).
2. Register it in the matching service file:

```js
// src/geocoding.js
import { myNewProvider } from "./providers/my-new-provider.js";

const providers = {
  [nominatimProvider.id]: nominatimProvider,
  [myNewProvider.id]: myNewProvider,
};
```

The settings panel picks it up automatically.

### Provider contracts

**Geocoding**
```js
{
  id, name, requiresKey, homepage?, signupUrl?,
  async geocode(address, { apiKey }) → { lat, lon, displayName }
}
```

**POIs**
```js
{
  id, name, requiresKey, homepage?, signupUrl?,
  async fetchPOIs({ lat, lon, radiusMeters, kinds }, { apiKey }) → POI[]
}
```

**Routing**
```js
{
  id, name, requiresKey, homepage?, signupUrl?,
  supportedModes: ("walk" | "bike" | "car" | "transit")[],
  // Durations in seconds; null means unreachable.
  async computeMatrix({ sources, destinations, mode, apiKey, onProgress }) → (number | null)[][]
}
```

## Tests

```sh
npm test
```

Covers the pure modules (`scoring` — sort / filter / format, `geometry` — Haversine / barycenter / prefilter). Network-bound providers are not mocked.

## Credits

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- Road routing: [OpenRouteService](https://openrouteservice.org/) (HeiGIT / Uni Heidelberg).
- Transit routing: [Transitous](https://transitous.org/) (MOTIS).
- Geocoding: [Nominatim](https://nominatim.org/).
