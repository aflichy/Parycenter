# Parycenter 🍺

Trouve le bar ou le restaurant qui **minimise le temps de trajet maximum** pour un groupe de personnes — chacune avec son propre mode de transport (marche, vélo, voiture, transports en commun).

Critère "équitable" : le lieu retenu est celui où **la personne la plus éloignée arrive le plus vite**.

## Lancer l'app

Site statique, aucun build. Servir avec n'importe quel serveur de fichiers :

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Ou :

```sh
npm run serve
```

Au premier lancement : déplier **⚙ Configuration des services** dans le panneau latéral et coller la clé OpenRouteService (nécessaire pour marche / vélo / voiture). Les transports en commun ne demandent pas de clé.

## Services externes

Chaque service externe est branché via un contrat de provider. Valeurs par défaut :

| Service | Provider par défaut | Clé ? |
|---|---|---|
| Géocodage | Nominatim (OSM) | — |
| POI (bars, restos) | Overpass (OSM) | — |
| Routing marche / vélo / voiture | OpenRouteService | requise — [inscription](https://openrouteservice.org/dev/#/signup) |
| Routing transports en commun | Transitous (MOTIS) | — |

Les choix de providers et les clés sont stockés dans le `localStorage` du navigateur (jamais envoyés ailleurs).

## Architecture

```
src/
├── app.js            ← contrôleur UI
├── map.js            ← rendu Leaflet
├── config.js         ← état (provider actif + clés) persisté en localStorage
├── geocoding.js      ← service : dispatch vers provider actif
├── pois.js           ← idem
├── routing.js        ← idem, groupe les participants par mode
├── scoring.js        ← tri par max(temps) des POI joignables par tous
├── geometry.js       ← Haversine, barycentre, pré-filtre par distance
└── providers/
    ├── nominatim.js         (géocodage)
    ├── overpass.js          (POI)
    ├── openrouteservice.js  (routing routier)
    └── transitous.js        (routing TC)
```

### Ajouter un provider

1. Créer `src/providers/<nom>.js` qui exporte un objet respectant le contrat du service (voir les providers existants).
2. L'enregistrer dans le service correspondant :

```js
// src/geocoding.js
import { monNouveauProvider } from "./providers/mon-nouveau.js";

const providers = {
  [nominatimProvider.id]: nominatimProvider,
  [monNouveauProvider.id]: monNouveauProvider,
};
```

Le panneau de configuration le détecte automatiquement.

### Contrats de provider

**Géocodage** : `async geocode(address, { apiKey }) → { lat, lon, displayName }`

**POI** : `async fetchPOIs({ lat, lon, radiusMeters, kinds }, { apiKey }) → POI[]`

**Routing** : déclare `supportedModes: ["walk"|"bike"|"car"|"transit"]` puis expose `async computeMatrix({ sources, destinations, mode, apiKey, onProgress }) → (number|null)[][]` (temps en secondes, `null` si injoignable).

## Tests

```sh
npm test
```

Couvre les modules purs : `scoring` (tri, filtrage, format) et `geometry` (Haversine, barycentre, pré-filtre). Les providers réseau ne sont pas mockés.

## Données et crédits

- Données cartographiques © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- Routing routier : [OpenRouteService](https://openrouteservice.org/) (HeiGIT / Uni Heidelberg).
- Routing transports : [Transitous](https://transitous.org/) (MOTIS).
- Géocodage : [Nominatim](https://nominatim.org/).
