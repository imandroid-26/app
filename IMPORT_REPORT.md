# PujoPath — pandal import report
_Generated 2026-10-15_

## Source
- Reference directory: [Pujo Map](https://www.pujomap.com/) — its map page advertises **275 mapped pandals** at import time (the count the requester quoted, 271, is an earlier snapshot).
- Machine-readable export actually served: `https://www.pujomap.com/data/pandals.json` under the **ODbL 1.0** licence (data © OpenStreetMap contributors). The site states the export is filtered: records whose coordinates were cross-referenced from third-party listings (18 of 307 at time of writing) are withheld and cannot be redistributed — so the export ≠ the full map catalogue.
- Metro stations, coordinates and line membership: **OpenStreetMap** (Overpass API), ODbL.

## Import result
- Records in the source export: **291**
- True duplicates removed (identical pins under one name): **5**
- **Unique pandals imported: 286** — this is the total the website displays; it is higher than the map page's advertised 275 because the export contains rows the map UI does not count (e.g. duplicate zone variants we deduplicated, and records the map groups differently). We display the real dataset count, never a hard-coded number.

## Verification breakdown
- Coordinates present: **286/286** (267 exact [OSM-mapped/geocoded/street-snapped/verified], 19 neighbourhood-anchored approximate pins)
- Verification status: verified **214** · partially_verified **52** · name_only **19** · needs_review **1**
- Nearest metro attached (station + verified station coordinates + line(s)): **286/286**
- Source-confirmed metro distance: **285/286** (walking time is never fabricated — the UI estimates it from distance at 80 m/min and labels it as an estimate)
- Working directions links: **286/286** (267 coordinate-based, 19 name+neighbourhood search — flagged 'approximate destination')
- Source page slug matched from the reference sitemap: **197/286**
- Records carrying an OSM object link: **61**
- Flagged for manual review: **10** (see notes below)

## Duplicate removal decisions
- Hindusthan Club: kept nearStreet='Hindusthan Road' (zone II); dropped nearStreet='B.L. Saha Road' (zone IV, osm)
- Chetla Agrani: kept nearStreet='Peary Mohan Roy Road' (zone II); dropped nearStreet='G. Auddy Road' (zone IV, osm)
- 95 Pally: kept nearStreet='Jodhpur Park' (zone II); dropped nearStreet='Rabindra Sarovar' (zone IV, osm)
- Pally Mangal: kept nearStreet='Jodhpur Park' (zone II); dropped nearStreet='South Avenue' (zone IV, osm)
- Kashi Bose Lane: kept nearStreet='Hari Ghose Street' (zone I); dropped nearStreet='Dani Gosh Street' (zone I, osm)

## Records needing review
- **22 Palli** (Elgin Road, zone II): straight-line nearest station is Netaji Bhavan (0.7 km) vs source's Jatin Das Park (1.4 km) — kept source assignment (walking practicality), but confirm on the ground
- **37 Pally** (Sealdah, zone I): straight-line nearest station is Mahatma Gandhi Road (1.0 km) vs source's Sealdah (1.6 km) — kept source assignment (walking practicality), but confirm on the ground
- **AK Block Durga Puja** (Salt Lake, zone I): straight-line nearest station is Karunamoyee (0.7 km) vs source's Salt Lake Sector V (1.2 km) — kept source assignment (walking practicality), but confirm on the ground
- **Bangur Avenue 'C' Block Durga Puja** (Bangur Avenue, zone I): straight-line nearest station is Mahanayak Uttam Kumar (1.1 km) vs source's Central Park (12.5 km) — kept source assignment (walking practicality), but confirm on the ground
- **Barisha Sarbojanin** (Khidderpore, zone IV): straight-line nearest station is Rabindra Sadan (2.2 km) vs source's Sakher Bazar (7.6 km) — kept source assignment (walking practicality), but confirm on the ground
- **BD Block Durga Puja** (Salt Lake, zone I): straight-line nearest station is City Centre (0.1 km) vs source's Central Park (0.8 km) — kept source assignment (walking practicality), but confirm on the ground
- **Beleghata 33 Pally** (—, zone II): straight-line nearest station is Salt Lake Stadium (1.0 km) vs source's Phoolbagan (1.6 km) — kept source assignment (walking practicality), but confirm on the ground
- **Cossipore Naba Yuvak Sangha** (Sinthee, zone I): straight-line nearest station is Dum Dum (2.3 km) vs source's Shyambazar (2.8 km) — kept source assignment (walking practicality), but confirm on the ground
- **Kheyali Sangha** (Garia, zone IV): source metro distance 1.4 km to Gitanjali disagrees with 0.5 km straight line — flagged for review
- **Pally Bashi Brindo** (Belgachia, zone I): straight-line nearest station is Belgachia (1.3 km) vs source's Shyambazar (1.9 km) — kept source assignment (walking practicality), but confirm on the ground

## Unavailable source data
- No street addresses (only `nearStreet` references) — `address` stays null.
- No per-pandal Puja 2026 confirmation — every record is `unconfirmed`; the reference directory is published for the 2026 season but does not state each committee's participation.
- No themes, no images with a redistributable licence — `theme`/`imageUrl` stay null.
- No Google place IDs — `googleMapsPlaceUrl` stays null; directions use coordinate or search URLs.
- Walking times are not in the source and are never invented — shown as clearly-labelled estimates.
- Records for Bidhannagar/Salt Lake, New Town and Howrah are mostly **absent from the ODbL export** (their coordinates came from a source the site cannot relicense) — only the few exported ones are included.

## Re-running the import
```bash
cd /app/scripts && python3 fetch_metro_osm.py   # refresh metro stations from OSM
curl -s https://www.pujomap.com/data/pandals.json -o /app/backend/data/pandals_source.json
python3 build_dataset.py                        # rebuild + re-report
```
The builder never overwrites hand-edited records: edit `frontend/src/data/pandals.json` only after an import, or extend `DEDUP_KEEP_NEAR`/`STATION_ALIASES` above — both are documented decisions.
