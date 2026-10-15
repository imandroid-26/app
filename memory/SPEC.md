# PujoPath — living spec

Kolkata Durga Puja 2026 companion: discover pandals, nearest metro, Google Maps directions, favourites, multi-stop route planner.

## Data
- Source: https://www.pujomap.com/data/pandals.json (ODbL) → 291 rows → 5 true duplicates removed → **286 unique pandals**.
- Metro stations + lines: OpenStreetMap Overpass (53 stations, 5 lines).
- Scripts: `scripts/fetch_metro_osm.py`, `scripts/build_dataset.py` → `frontend/src/data/{pandals,metro_stations}.{json,data.ts}` + `/app/IMPORT_REPORT.md`.
- Statuses: verified 214 · partially_verified 52 · name_only 19 (neighbourhood-anchor pins) · needs_review 1. puja2026Status = unconfirmed for all (source has no per-pandal confirmation).
- Dataset is bundled in the frontend (works with no backend). Backend offers read-only `/api/pandals`, `/api/pandals/stats`, `/api/pandals/{id}`.

## Routes
- `/` home (Durga hero), `/explore` (search q, zones, statuses, metro, p2026, sort, view=map in URL params), `/pandal/:id`, `/map`, `/my-pujas`, `/planner` (`?stops=a,b` share link).

## Persistence (localStorage)
- `pujopath_favourites`, `pujopath_planner_stops`, `pujopath_itineraries`.

## Rules
- Distances from user = Haversine, labelled straight-line. Walk minutes = 80 m/min estimate, labelled.
- Approximate pins → Google Maps name search destination + warnings.
- Planner: nearest-neighbour + 2-opt; links split into ≤10 stops (9 waypoint limit).
- No auth, no API keys.
