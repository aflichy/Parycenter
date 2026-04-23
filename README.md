# Parycenter 🍺

**Live → https://aflichy.github.io/Parycenter/**

Finds the bar or restaurant that minimizes the **maximum travel time** across a group — each person with their own mode (walk / bike / car / transit). The winner is where the worst-off person arrives fastest.

## Run locally

```sh
npm run serve   # python3 -m http.server 8000
```

Then open http://localhost:8000 and paste your OpenRouteService key under ⚙ Service configuration.

## Services (all pluggable)

| Service | Default | Key |
|---|---|---|
| Geocoding | Nominatim (OSM) | — |
| POIs | Overpass (OSM) | — |
| Routing — road | OpenRouteService | required ([sign up](https://openrouteservice.org/dev/#/signup)) |
| Routing — transit | Transitous (MOTIS) | — |

Provider selections + keys live in the browser's `localStorage`.

## Architecture

`src/providers/*.js` — one file per provider, each exporting an object that matches its service contract. To add a provider, create the file and register it in the matching service (`geocoding.js`, `pois.js`, or `routing.js`). The settings panel picks it up automatically.

Pure helpers (`scoring.js`, `geometry.js`) have no I/O and are unit-tested.

## Tests

```sh
npm test
```

## Thanks

Original idea credit goes to [@millotp](https://github.com/millotp), [@gabaid971](https://github.com/gabaid971), and [@Sawyer-815](https://github.com/Sawyer-815). The initial name we came up with together was **Beer In The Middle**.

## Credits

Data © [OpenStreetMap](https://www.openstreetmap.org/copyright) · routing [OpenRouteService](https://openrouteservice.org/) + [Transitous](https://transitous.org/) · geocoding [Nominatim](https://nominatim.org/).
