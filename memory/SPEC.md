# PujoPath — living spec

Kolkata Durga Puja 2026 companion: discover pandals, nearest metro, Google Maps directions, favourites, multi-stop route planner.

## Data (see /app/IMPORT_REPORT.md and /app/REVIEW_LIST.md for live numbers)
- Source 1: https://www.pujomap.com/data/pandals.json (ODbL) → 291 rows → 5 true duplicates removed → 286.
- Source 2 (Phase 8): pujomap public pages missing from the export → 78 pages; 4 = existing records (linked), **74 added** (facts only).
  Their coordinates are NOT copied (directory can't sublicense them); positions derived from OSM Nominatim and only *checked*
  against the directory's position: ≤120 m → exact, ≤500 m → approximate, else/none → lat/lon null (locationAccuracy "unknown").
- **360 unique pandals.** Zones I–IV (Kolkata Police) + **V Salt Lake, New Town & North-East** + **VI Howrah**.
- Metro fields: nearestMetro (directory's or straight-line nearest), metroStraightLineKm (straight line), distanceFromMetroKm +
  walkingTimeFromMetroMinutes (ROUTED, OSRM foot via routing.openstreetmap.de, exact pins only), practicalMetro* (shortest routed walk of 3 nearest).
- Hand corrections: backend/data/manual_overrides.json (applied last, never overwritten).
- Metro stations + lines: OpenStreetMap Overpass (53 stations, 5 lines).
- Scripts: `fetch_metro_osm.py`, `fetch_pujomap_pages.py`, `geocode_additions_osm.py`, `osm_name_pass.py`, `route_metro_walks.py`, `build_dataset.py` → `frontend/src/data/{pandals,metro_stations}.{json,data.ts}` + `/app/IMPORT_REPORT.md`.
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

## Puja Guide (Gemini 3 Flash)
- `/guide` page; `POST /api/guide/chat {session_id, message, user_lat?, user_lon?}` → SSE `data: {type: delta|done|error}`.
- Grounded: backend retrieves ≤24 relevant records (+ live crowd) and Gemini (`gemini-3-flash-preview`, EMERGENT_LLM_KEY via emergentintegrations) may only use them; cites `[[pandal-id]]` → UI "view" chips.
- History in Mongo `guide_messages`; `GET /api/guide/sessions/{id}/messages`, `DELETE /api/guide/sessions/{id}`. Session id in localStorage `pujopath_guide_session`.
- Pins: records with lat null are never mapped; Directions = Google Maps name search; cards show "Location not verified".
