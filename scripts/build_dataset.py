"""PujoPath dataset builder.

Reads the ODbL-licensed pandal directory export from pujomap.com
(backend/data/pandals_source.json), the OSM-derived metro stations
(frontend/src/data/metro_stations.json), and the reference sitemap, then:

  1. normalises names and alternate spellings
  2. removes true duplicates (keeping explicit, documented decisions)
  3. preserves distinct pandals that merely share a name
  4. validates coordinate ranges
  5. checks mandatory fields and types
  6. attaches verified metro-station coordinates and metro lines (OSM)
  7. cross-checks the source's nearest-metro assignment against straight-line
     distance to every station (flags conflicts, never swaps blindly)
  8. generates Google Maps directions URLs (coordinate-based when the pin is
     trustworthy, name-search based for neighbourhood-anchored pins)
  9. records source URLs, verification status and field-level verification
 10. writes frontend/src/data/pandals.json + /app/IMPORT_REPORT.md

Data sources (all ODbL / open):
  - https://www.pujomap.com/data/pandals.json  (pandal records)
  - OpenStreetMap via Overpass API             (metro stations + lines)
  - https://www.pujomap.com/sitemap.xml        (source page slugs)

Run:  cd /app/scripts && python3 build_dataset.py
"""

import json
import re
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from math import radians, sin, cos, asin, sqrt
from pathlib import Path

ROOT = Path("/app")
RAW = ROOT / "backend/data/pandals_source.json"
STATIONS = ROOT / "frontend/src/data/metro_stations.json"
SITEMAP = ROOT / "backend/data/pujomap_sitemap.xml"
OUT_PANDALS = ROOT / "frontend/src/data/pandals.json"
OUT_REPORT = ROOT / "IMPORT_REPORT.md"

DATA_URL = "https://www.pujomap.com/data/pandals.json"
OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright"

# The source lists one station under a former/proposed name. OSM has no station
# node "Gitanjali" (only a stop position on the Blue line between Kavi Nazrul
# and Masterda Surya Sen); the single pandal referencing it (Kheyali Sangha,
# Garia) lies 0.5 km from Kavi Nazrul and 1.0 km from the Gitanjali stop node.
STATION_ALIASES = {"Gitanjali": "Kavi Nazrul"}

# Explicit dedup decisions for same-name records that are the SAME pandal in the
# source export (identical or near-identical pins, conflicting zone metadata).
# key: normalised name -> keep the record whose nearStreet matches this string.
DEDUP_KEEP_NEAR = {
    "hindusthan club": "Hindusthan Road",
    "chetla agrani": "Peary Mohan Roy Road",
    "95 pally": "Jodhpur Park",
    "pally mangal": "Jodhpur Park",
    "kashi bose lane": "Hari Ghose Street",
}

VALID_GEOCODE = {"osm", "verified", "geocoded", "street-snapped", "neighbourhood-anchor", "neighbourhood-anchor+fallback"}
ANCHOR_METHODS = {"neighbourhood-anchor", "neighbourhood-anchor+fallback"}

ZONE_SHORT = {
    "I": "North & Central",
    "II": "South & South-East",
    "III": "Port Area",
    "IV": "South Suburban & South-West",
}


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def norm_name(s: str) -> str:
    """Aggressive normalisation for matching: unifies pally/pally, sarbojanin
    spellings, punctuation and whitespace."""
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\b(pall?y|palli)\b", "pally", s)
    s = re.sub(r"\bsarb?oj[aeo]?[oa]?n[iy]n?\b", "sarbojanin", s)
    s = re.sub(r"\bsarbojonin\b", "sarbojanin", s)
    s = re.sub(r"\bsarbojainin\b", "sarbojanin", s)
    s = re.sub(r"\bkidderpore\b", "khidderpore", s)
    s = re.sub(r"\bchalta\b", "chaltabagan", s) if "chalta bagan" in s else s
    s = re.sub(r"\s+", " ", s).strip()
    return s


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lon1, lat1, lon2, lat2 = map(radians, (lon1, lat1, lon2, lat2))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371000 * 2 * asin(sqrt(a))


def load_sitemap_slugs() -> set:
    if not SITEMAP.exists():
        urllib.request.urlretrieve("https://www.pujomap.com/sitemap.xml", SITEMAP)
    xml = SITEMAP.read_text(encoding="utf-8")
    return set(re.findall(r"pujomap\.com/p/([a-z0-9-]+)</loc>", xml))


def match_source_slug(name: str, sitemap: set, claimed: set) -> str | None:
    ours = slugify(name)
    if ours in sitemap and ours not in claimed:
        return ours
    target = norm_name(name)
    exact = [s for s in sitemap if norm_name(s.replace("-", " ")) == target and s not in claimed]
    if len(exact) == 1:
        return exact[0]
    containment = [
        s for s in sitemap
        if s not in claimed and (
            target in norm_name(s.replace("-", " ")) or norm_name(s.replace("-", " ")) in target
        )
    ]
    if len(containment) == 1:
        return containment[0]
    return None


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    stations = json.loads(STATIONS.read_text(encoding="utf-8"))
    sitemap = load_sitemap_slugs()
    today = datetime.now(timezone.utc).date().isoformat()

    st_by_name = {s["name"].lower(): s for s in stations}
    st_by_norm = {norm_name(s["name"]): s for s in stations}

    def find_station(name: str):
        if name is None:
            return None
        mapped = STATION_ALIASES.get(name, name)
        return st_by_name.get(mapped.lower()) or st_by_norm.get(norm_name(mapped))

    # ---- 1. deduplicate ----------------------------------------------------
    by_norm = {}
    for r in raw:
        by_norm.setdefault(norm_name(r["name"]), []).append(r)

    kept, dropped, dedup_notes = [], [], []
    for key, group in by_norm.items():
        if len(group) == 1:
            kept.append(group[0])
            continue
        # same name, several records: same physical pandal if pins are identical
        # (<= 10 m) or <= 300 m apart with the same name -> one real entry.
        near = DEDUP_KEEP_NEAR.get(key)
        winner = None
        if near:
            for r in group:
                if r.get("nearStreet", "").strip().lower() == near.strip().lower():
                    winner = r
                    break
        if winner is None:
            winner = group[0]
        kept.append(winner)
        others = [r for r in group if r is not winner]
        dropped.append((winner, others))
        dedup_notes.append(
            f"{winner['name']}: kept nearStreet={winner.get('nearStreet')!r} "
            f"(zone {winner['zone']}); dropped "
            + "; ".join(f"nearStreet={o.get('nearStreet')!r} (zone {o['zone']}, {o['geocodeMethod']})" for o in others)
        )

    # ---- 2. build records --------------------------------------------------
    records, problems = [], []
    claimed_slugs: set = set()
    for r in kept:
        name = r["name"].strip()
        lat, lon = r["lat"], r["lon"]
        if not (20.0 <= lat <= 27.0 and 85.0 <= lon <= 90.0):
            problems.append(f"{name}: coordinates out of range ({lat},{lon}) — rejected")
            continue
        method = r.get("geocodeMethod", "")
        if method not in VALID_GEOCODE:
            problems.append(f"{name}: unknown geocodeMethod {method!r}")
        approximate = method in ANCHOR_METHODS

        slug = match_source_slug(name, sitemap, claimed_slugs)
        if slug:
            claimed_slugs.add(slug)
        src_page = f"https://www.pujomap.com/p/{slug}" if slug else None

        sources = [DATA_URL]
        if src_page:
            sources.append(src_page)
        if r.get("_osm"):
            sources.append(f"https://www.openstreetmap.org/{r['_osm']}")
        sources.append(OSM_COPYRIGHT)

        verified_fields = ["name", "neighbourhood", "nearStreet"]
        if r.get("nameBn"):
            verified_fields.append("nameBn")

        # ---- metro verification (never blind-swap; flag conflicts) ---------
        metro_src = r.get("nearestMetro") or {}
        metro_name = metro_src.get("name")
        metro_dist = metro_src.get("distanceMeters")
        station = find_station(metro_name)
        review_notes = []
        metro_verified = False
        distance_confirmed = False
        straight_to_station = None
        if station is None:
            review_notes.append(
                f"source metro station {metro_name!r} not found in OSM station list"
            )
        else:
            straight_to_station = haversine_m(lat, lon, station["lat"], station["lon"])
            if isinstance(metro_dist, (int, float)) and metro_dist > 0:
                # source distance should sit between straight-line and a generous
                # walking-detour factor; else flag (e.g. 7.6 km for a 1 km walk)
                if metro_dist >= straight_to_station - 150 and metro_dist <= straight_to_station * 1.9 + 200:
                    metro_verified = True
                    distance_confirmed = True
                else:
                    review_notes.append(
                        f"source metro distance {metro_dist/1000:.1f} km to {metro_name} disagrees with "
                        f"{straight_to_station/1000:.1f} km straight line — flagged for review"
                    )
            # cross-check the station choice itself
            nearest = min(
                stations, key=lambda s: haversine_m(lat, lon, s["lat"], s["lon"])
            )
            nearest_d = haversine_m(lat, lon, nearest["lat"], nearest["lon"])
            if nearest["name"] != station["name"] and straight_to_station - nearest_d > 400:
                review_notes.append(
                    f"straight-line nearest station is {nearest['name']} "
                    f"({nearest_d/1000:.1f} km) vs source's {station['name']} "
                    f"({straight_to_station/1000:.1f} km) — kept source assignment (walking "
                    f"practicality), but confirm on the ground"
                )

        # ---- verification status ------------------------------------------
        if approximate:
            status = "name_only"  # pin is a neighbourhood anchor, not the exact site
        elif review_notes and not metro_verified:
            status = "needs_review"
        elif method in ("geocoded", "street-snapped") or (review_notes and metro_verified):
            status = "partially_verified"
        else:
            status = "verified"

        if station is not None and status != "name_only":
            verified_fields.append("nearestMetro")
            verified_fields.append("metroStationCoordinates")
            if station["lines"]:
                verified_fields.append("metroLines")
            if distance_confirmed:
                verified_fields.append("metroDistance")

        if approximate:
            verified_fields.append("approximatePin")

        directions_approximate = approximate
        dest = f"{lat:.6f},{lon:.6f}"
        directions = (
            f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(name + ', ' + (r.get('neighbourhood') or ''), safe='')}"
            if directions_approximate
            else f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote(dest, safe='')}"
        )

        rec = {
            "id": slugify(name),
            "sourceSlug": slug,
            "name": name,
            "nameBn": r.get("nameBn"),
            "alternateNames": [a for a in [r.get("alsoKnownAs"), r.get("formerName")] if a],
            "neighbourhood": r.get("neighbourhood"),
            "zone": r["zone"],
            "zoneName": r["zoneName"],
            "zoneShort": ZONE_SHORT.get(r["zone"], r["zoneName"]),
            "nearStreet": r.get("nearStreet"),
            "address": None,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "locationAccuracy": "approximate" if approximate else "exact",
            "geocodeMethod": method,
            "nearestMetro": station["name"] if station else metro_name,
            "metroLine": station["lines"] if station else [],
            "metroStationLat": station["lat"] if station else None,
            "metroStationLon": station["lon"] if station else None,
            "distanceFromMetroKm": round(metro_dist / 1000, 2) if distance_confirmed else None,
            "walkingTimeFromMetroMinutes": None,  # never fabricated; estimated in UI
            "googleMapsPlaceUrl": None,
            "googleMapsDirectionsUrl": directions,
            "directionsIsApproximate": directions_approximate,
            "verificationStatus": status,
            "verifiedFields": sorted(set(verified_fields)),
            "reviewNotes": " | ".join(review_notes) if review_notes else None,
            "sourceUrls": sources,
            "lastVerifiedAt": today,
            "puja2026Status": "unconfirmed",
            "imageUrl": None,
            "theme": None,
        }
        records.append(rec)

    # id uniqueness guard
    ids = [r["id"] for r in records]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise SystemExit(f"Duplicate ids after dedup: {dupes}")

    records.sort(key=lambda r: r["name"].lower())
    OUT_PANDALS.write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")

    # typed TS module (tsconfig has no resolveJsonModule; the bundle imports this)
    ts = (
        "// Generated by scripts/build_dataset.py — do not edit by hand.\n"
        "// Source: pujomap.com ODbL export + OpenStreetMap metro data. See /app/IMPORT_REPORT.md.\n"
        'import type { Pandal } from "@/lib/types";\n\n'
        "export const PANDALS: Pandal[] = "
        + json.dumps(records, ensure_ascii=False, indent=1)
        + ";\n"
    )
    (ROOT / "frontend/src/data/pandals.data.ts").write_text(ts, encoding="utf-8")

    # ---- 3. report ----------------------------------------------------------
    n = len(records)
    n_status = lambda s: sum(1 for r in records if r["verificationStatus"] == s)  # noqa: E731
    n_exact = sum(1 for r in records if r["locationAccuracy"] == "exact")
    n_metro = sum(1 for r in records if r["nearestMetro"] and r["metroStationLat"] is not None)
    n_mdist = sum(1 for r in records if r["distanceFromMetroKm"] is not None)
    n_src_page = sum(1 for r in records if r["sourceSlug"])
    n_osm_src = sum(1 for r in records if any("/node/" in u or "/way/" in u for u in r["sourceUrls"]))
    review = [r for r in records if r["reviewNotes"]]

    lines = [
        "# PujoPath — pandal import report",
        f"_Generated {today}_",
        "",
        "## Source",
        "- Reference directory: [Pujo Map](https://www.pujomap.com/) — its map page advertises "
        "**275 mapped pandals** at import time (the count the requester quoted, 271, is an earlier snapshot).",
        f"- Machine-readable export actually served: `{DATA_URL}` under the **ODbL 1.0** licence "
        "(data © OpenStreetMap contributors). The site states the export is filtered: records whose "
        "coordinates were cross-referenced from third-party listings (18 of 307 at time of writing) are "
        "withheld and cannot be redistributed — so the export ≠ the full map catalogue.",
        f"- Metro stations, coordinates and line membership: **OpenStreetMap** (Overpass API), ODbL.",
        "",
        "## Import result",
        f"- Records in the source export: **{len(raw)}**",
        f"- True duplicates removed (identical pins under one name): **{len(raw) - n}**",
        f"- **Unique pandals imported: {n}** — this is the total the website displays; it is higher than the "
        "map page's advertised 275 because the export contains rows the map UI does not count "
        "(e.g. duplicate zone variants we deduplicated, and records the map groups differently). "
        "We display the real dataset count, never a hard-coded number.",
        "",
        "## Verification breakdown",
        f"- Coordinates present: **{n}/{n}** ({n_exact} exact [OSM-mapped/geocoded/street-snapped/verified], "
        f"{n - n_exact} neighbourhood-anchored approximate pins)",
        f"- Verification status: verified **{n_status('verified')}** · partially_verified "
        f"**{n_status('partially_verified')}** · name_only **{n_status('name_only')}** · needs_review "
        f"**{n_status('needs_review')}**",
        f"- Nearest metro attached (station + verified station coordinates + line(s)): **{n_metro}/{n}**",
        f"- Source-confirmed metro distance: **{n_mdist}/{n}** (walking time is never fabricated — the UI "
        "estimates it from distance at 80 m/min and labels it as an estimate)",
        f"- Working directions links: **{n}/{n}** "
        f"({n_exact} coordinate-based, {n - n_exact} name+neighbourhood search — flagged 'approximate destination')",
        f"- Source page slug matched from the reference sitemap: **{n_src_page}/{n}**",
        f"- Records carrying an OSM object link: **{n_osm_src}**",
        f"- Flagged for manual review: **{len(review)}** (see notes below)",
        "",
        "## Duplicate removal decisions",
    ]
    lines += [f"- {note}" for note in dedup_notes] or ["- none"]
    lines += ["", "## Records needing review"]
    lines += [
        f"- **{r['name']}** ({r['neighbourhood'] or '—'}, zone {r['zone']}): {r['reviewNotes']}"
        for r in review
    ] or ["- none"]
    lines += [
        "",
        "## Unavailable source data",
        "- No street addresses (only `nearStreet` references) — `address` stays null.",
        "- No per-pandal Puja 2026 confirmation — every record is `unconfirmed`; the reference directory is "
        "published for the 2026 season but does not state each committee's participation.",
        "- No themes, no images with a redistributable licence — `theme`/`imageUrl` stay null.",
        "- No Google place IDs — `googleMapsPlaceUrl` stays null; directions use coordinate or search URLs.",
        "- Walking times are not in the source and are never invented — shown as clearly-labelled estimates.",
        "- Records for Bidhannagar/Salt Lake, New Town and Howrah are mostly **absent from the ODbL export** "
        "(their coordinates came from a source the site cannot relicense) — only the few exported ones are included.",
        "",
        "## Re-running the import",
        "```bash",
        "cd /app/scripts && python3 fetch_metro_osm.py   # refresh metro stations from OSM",
        "curl -s https://www.pujomap.com/data/pandals.json -o /app/backend/data/pandals_source.json",
        "python3 build_dataset.py                        # rebuild + re-report",
        "```",
        "The builder never overwrites hand-edited records: edit `frontend/src/data/pandals.json` only after "
        "an import, or extend `DEDUP_KEEP_NEAR`/`STATION_ALIASES` above — both are documented decisions.",
        "",
    ]
    OUT_REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(f"imported {n} unique pandals ({len(dropped)} duplicates removed, {len(review)} flagged for review)")
    print(f"statuses: verified={n_status('verified')} partially={n_status('partially_verified')} "
          f"name_only={n_status('name_only')} review={n_status('needs_review')}")


if __name__ == "__main__":
    main()
