# PujoPath — data import & quality audit
_Generated 2026-10-15 by `scripts/build_dataset.py`_

## Sources and access
- **Pujo Map ODbL export** `https://www.pujomap.com/data/pandals.json`: 291 rows (unchanged since first import). Positions are OSM-derived or hand-placed; licence ODbL 1.0.
- **Pujo Map public pages** (sitemap: 275 pandal pages). Pages for pandals absent from the export were read for *facts* (name, locality, street reference, the directory's named metro). Their coordinates were **not copied** — the directory states those positions came from a third-party listing it cannot sublicense. They were used only to *check* our independently derived pins.
- **OpenStreetMap**: Nominatim + Overpass for positions of the page-only pandals; Overpass for metro stations and line membership.
- **Pedestrian routing**: https://routing.openstreetmap.de (OSRM foot profile, © OpenStreetMap contributors) — walking distance/time from each precisely-located pandal to its 3 straight-line-nearest stations.
- **Google Maps**: not queried programmatically (no API key configured; scraping Google is not permitted). Directions use Google's public URL scheme only; no place IDs.
- **Official Kolkata Metro site** (mtp.indianrailways.gov.in): timed out from the build server, so station names/lines are cross-checked against OSM only.

## Phase 8 — Salt Lake, New Town, Rajarhat & North-East
- Reference pages not represented in the export: **78**
- Duplicates of existing records under another spelling (linked as sources, IDs kept): **4** — kumartuli-park → kumartuli-sarbojanin, pathuriaghata-5er-pally → pathuria-ghata-5-pally, players-corner → player-s-corner, taltala-childrens-park-14-palli → taltala-children-s-park-14-palli
- **New pandals added: 74** (city-wide), of which **25** in Salt Lake / New Town / North-East
  - with a corroborated exact pin: 12 · approximate pin: 7 · no pin (searchable, name-search directions): 55
- Existing records updated: **18** — linked reference page: 4; neighbourhood derived from street reference: 5; zone I → V: 8; zone II → V: 1
- New Town Action Areas II & III and Rajarhat proper: **no pandal pages exist in the reference directory** and no puja feature is mapped in OSM, so none were added — we do not assume every block holds a registered puja.

## Phase 9 — audit of the whole dataset
| Metric | Count |
|---|---|
| Rows read (export 291 + page-only 78) | 369 |
| True duplicates removed | 5 in export + 4 page↔record |
| **Unique pandals in the dataset** | **360** |
| Verified street addresses | 0 — sources give street references, not postal addresses |
| Verified (exact) coordinates | 279 |
| Approximate pins (shown hollow) | 26 |
| No coordinates (list + search only) | 55 |
| Nearest metro attached with verified station coordinates/lines | 305 |
| Routed pedestrian distance (OSRM foot) | 278 |
| … where the shortest walk is from a different station than the listed one | 13 |
| Directions links passing structural validation | 360 / 360 |
| Status verified | 230 |
| Status partially_verified | 56 |
| Status name_only | 74 |
| Status needs_review | 0 |
| Confirmed for Puja 2026 by organisers | 0 — no source states per-pandal participation |

**Zones:** North & Central Kolkata 97, South & South-East Kolkata 78, Port Area 9, South Suburban & South-West Kolkata 135, Salt Lake, New Town & North-East 34, Howrah 7

A Directions link that opens is not proof its destination is right. Coordinate links are validated against the record's own pin; name-search links are validated to contain the pandal name — the user must confirm the result in Google Maps (the UI says so).

**Metro distances corrected:** earlier builds labelled the export's `distanceMeters` as a walking distance. The directory's own pages state it is measured in a straight line, so it now lives in `metroStraightLineKm`; `distanceFromMetroKm`/`walkingTimeFromMetroMinutes` hold only routed walking values.

## Export duplicate decisions
- Hindusthan Club: kept nearStreet='Hindusthan Road'; dropped 'B.L. Saha Road' (osm)
- Chetla Agrani: kept nearStreet='Peary Mohan Roy Road'; dropped 'G. Auddy Road' (osm)
- 95 Pally: kept nearStreet='Jodhpur Park'; dropped 'Rabindra Sarovar' (osm)
- Pally Mangal: kept nearStreet='Jodhpur Park'; dropped 'South Avenue' (osm)
- Kashi Bose Lane: kept nearStreet='Hari Ghose Street'; dropped 'Dani Gosh Street' (osm)

## Link validation failures
- none

## Re-running
```bash
cd /app/scripts
python3 fetch_metro_osm.py        # OSM stations + lines
python3 fetch_pujomap_pages.py    # facts from pages missing from the export (cached)
python3 geocode_additions_osm.py && python3 osm_name_pass.py   # OSM positions for them
python3 build_dataset.py          # build once to get pins
python3 route_metro_walks.py     # pedestrian routes (cached)
python3 build_dataset.py          # final build + reports
```
Hand corrections go in `backend/data/manual_overrides.json` (keyed by id) and always win over imports.
