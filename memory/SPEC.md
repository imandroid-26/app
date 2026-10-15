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

## Puja calendar & banner
- Days (Kolkata): Mahalaya 10 Oct; Shashthi 16; **two Saptamis 17 & 18** (keys saptami-1/2); Ashtami 19; Navami 20; Dashami 21 Oct 2026.
- `GET /api/puja/today[?on=YYYY-MM-DD]` → phase before/during/after, current/next day, days/seconds until Shashthi. Anchored to Asia/Kolkata server-side.
- Banner under the nav: countdown before, "Shubho <day>" + Today's route link during, Bijoya message after. Hidden if backend unreachable.

## Live crowd reports (Mongo `crowd_reports`)
- `POST /api/crowd/reports {pandal_id, level: easy|busy|packed, client_id}` → 201; unknown pandal 404; same device+pandal within 10 min → 429.
- `GET /api/crowd/summary` (all pandals with reports in last 90 min, recency-weighted level), `GET /api/crowd/summary/{id}` (404 if none).
- client_id = anonymous random id in localStorage `pujopath_client_id`. Docs TTL-expire after 1 day.
- UI: crowd panel with 3 buttons on pandal detail; crowd chip on cards when reports exist.

## Puja day picker
- Route Planner → "Pick a puja day": 6 buttons (each Saptami separate) load curated stops (lib/puja.ts DAY_ROUTES) ordered by optimizeOrder. `/planner?day=<key>` does the same.
