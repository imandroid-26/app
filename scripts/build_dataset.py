"""PujoPath dataset builder (repeatable).

Inputs
  backend/data/pandals_source.json      ODbL export of pujomap.com (positions OSM-derived/hand-placed)
  backend/data/pujomap_sitemap.xml      reference page slugs
  backend/data/pujomap_pages.json       facts from public pages NOT in the export (scripts/fetch_pujomap_pages.py)
  backend/data/additions_geocoded.json  OSM-derived positions for those pages (scripts/geocode_additions_osm.py, osm_name_pass.py)
  backend/data/walk_cache.json          OSRM-foot pedestrian routes to nearby stations (scripts/route_metro_walks.py)
  backend/data/manual_overrides.json    hand-verified corrections, applied LAST and never overwritten
  frontend/src/data/metro_stations.json OSM metro stations + lines (scripts/fetch_metro_osm.py)

Outputs
  frontend/src/data/pandals.json + pandals.data.ts
  /app/IMPORT_REPORT.md   import + data-quality audit
  /app/REVIEW_LIST.md     every unresolved pandal, its missing fields and why

Licensing: positions for the page-only additions are never copied from the
directory (it cannot sublicense them). The directory's published position is
used only as an independent CHECK on our OSM-derived pin.
"""

import json
import re
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

ROOT = Path("/app")
D = ROOT / "backend/data"
RAW = D / "pandals_source.json"
SITEMAP = D / "pujomap_sitemap.xml"
PAGES = D / "pujomap_pages.json"
ADDITIONS = D / "additions_geocoded.json"
WALKS = D / "walk_cache.json"
OVERRIDES = D / "manual_overrides.json"
STATIONS = ROOT / "frontend/src/data/metro_stations.json"
OUT_JSON = ROOT / "frontend/src/data/pandals.json"
OUT_TS = ROOT / "frontend/src/data/pandals.data.ts"
OUT_REPORT = ROOT / "IMPORT_REPORT.md"
OUT_REVIEW = ROOT / "REVIEW_LIST.md"

DATA_URL = "https://www.pujomap.com/data/pandals.json"
OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright"
ROUTER = "https://routing.openstreetmap.de (OSRM foot profile, © OpenStreetMap contributors)"

STATION_ALIASES = {"Gitanjali": "Kavi Nazrul"}  # former/proposed name; see report

# Same-name rows in the export that are one pandal (identical/near-identical pins).
DEDUP_KEEP_NEAR = {
    "hindusthan club": "Hindusthan Road",
    "chetla agrani": "Peary Mohan Roy Road",
    "95 pally": "Jodhpur Park",
    "pally mangal": "Jodhpur Park",
    "kashi bose lane": "Hari Ghose Street",
}

# Reference pages that are existing records under another spelling (pins 0–7 m apart, names agree).
PAGE_MATCHES = {
    "kumartuli-park": "kumartuli-sarbojanin",
    "pathuriaghata-5er-pally": "pathuria-ghata-5-pally",
    "players-corner": "player-s-corner",
    "taltala-childrens-park-14-palli": "taltala-children-s-park-14-palli",
}

ZONE_NAMES = {
    "I": "North & Central Kolkata",
    "II": "South & South-East Kolkata",
    "III": "Port Area",
    "IV": "South Suburban & South-West Kolkata",
    "V": "Salt Lake, New Town & North-East",
    "VI": "Howrah",
}
ZONE_SHORT = {
    "I": "North & Central", "II": "South & South-East", "III": "Port Area",
    "IV": "South Suburban & South-West", "V": "Salt Lake & New Town", "VI": "Howrah",
}
NE_WORDS = ["salt lake", "bidhannagar", "new town", "newtown", "action area", "rajarhat", "lake town", "laketown",
            "baguiati", "kestopur", "dum dum park", "bangur avenue", "sreebhumi", "karunamoyee"]
HOWRAH_WORDS = ["howrah", "salkia", "shibpur", "liluah", "netajigarh", "ghasbagan"]
REGION_ZONE = {
    "North Kolkata": "I", "Central Kolkata": "I", "South Kolkata": "II",
    "Behala & South-West Kolkata": "IV", "Salt Lake, New Town & the North-East": "V", "Howrah": "VI",
}
LOCALITY_ZONE = {  # fallback when a record has neither region nor pin
    "sealdah": "I", "wellington": "I", "park street": "I", "chorbagan": "I", "darjipara": "I", "beadon street": "I",
    "jhamapukur": "I", "jorabagan": "I", "hatkhola": "I", "pathuriaghata": "I", "thanthania": "I", "sovabazar": "I",
    "kankurgachi": "I", "ultadanga": "I", "agarpara": "I", "dum dum": "I", "kumartuli": "I", "shyambazar": "I",
    "jorasanko": "I", "bhawanipore": "II", "hazra": "II", "dhakuria": "II", "kasba": "II", "santoshpur": "II",
    "kalighat": "II", "baghajatin": "II", "behala": "IV", "putiary": "IV", "thakurpukur": "IV",
    "khidderpore": "IV", "barisha": "IV",
}
LOCALITY_FROM_STREET = ["Salt Lake", "New Town", "Lake Town", "Baguiati", "Kestopur", "Dum Dum Park", "Bangur Avenue",
                        "Beleghata", "Nagerbazar", "Dum Dum", "Rajarhat"]

ANCHOR_METHODS = {"neighbourhood-anchor", "neighbourhood-anchor+fallback"}
CORROBORATE_EXACT_M = 120
CORROBORATE_APPROX_M = 500


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def norm_name(s):
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\b(pall?y|palli)\b", "pally", s)
    s = re.sub(r"\bsarb?oj[aeo]?[oa]?n[iy]n?\b|\bsarbojonin\b|\bsarbojainin\b", "sarbojanin", s)
    s = re.sub(r"\bkidderpore\b", "khidderpore", s)
    return re.sub(r"\s+", " ", s).strip()


def hv(lat1, lon1, lat2, lon2):
    lon1, lat1, lon2, lat2 = map(radians, (lon1, lat1, lon2, lat2))
    a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 6371000 * 2 * asin(sqrt(a))


def load(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def match_source_slug(name, sitemap, claimed):
    ours = slugify(name)
    if ours in sitemap and ours not in claimed:
        return ours
    target = norm_name(name)
    exact = [s for s in sitemap if s not in claimed and norm_name(s.replace("-", " ")) == target]
    if len(exact) == 1:
        return exact[0]
    cont = [s for s in sitemap if s not in claimed and (target in norm_name(s.replace("-", " ")) or norm_name(s.replace("-", " ")) in target)]
    return cont[0] if len(cont) == 1 else None


def zone_for(text, region, fallback):
    # "Bidhannagar Road" is a street in Ultadanga (North Kolkata), not Bidhannagar/Salt Lake
    t = text.lower().replace("bidhannagar road", "")
    if any(w in t for w in HOWRAH_WORDS):
        return "VI"
    if any(w in t for w in NE_WORDS):
        return "V"
    if region in REGION_ZONE:
        return REGION_ZONE[region]
    return fallback


def directions_url(name, neigh, lat, lon, exact):
    if exact and lat is not None:
        return "https://www.google.com/maps/dir/?api=1&destination=" + urllib.parse.quote(f"{lat:.6f},{lon:.6f}", safe="")
    q = f"{name}, {neigh}, Kolkata" if neigh else f"{name}, Kolkata"
    return "https://www.google.com/maps/search/?api=1&query=" + urllib.parse.quote(q, safe="")


def validate_link(url, rec):
    """Structural check that the link encodes a usable destination. A link that
    opens is NOT proof that its destination is correct."""
    u = urllib.parse.urlparse(url)
    if u.scheme != "https" or u.netloc != "www.google.com" or not u.path.startswith("/maps/"):
        return "bad host/path"
    qs = urllib.parse.parse_qs(u.query)
    if qs.get("api") != ["1"]:
        return "missing api=1"
    if u.path == "/maps/dir/":
        dest = qs.get("destination", [""])[0]
        m = re.fullmatch(r"(-?\d+\.\d+),(-?\d+\.\d+)", dest)
        if not m:
            return "destination not lat,lon"
        lat, lon = float(m.group(1)), float(m.group(2))
        if not (22.3 <= lat <= 22.8 and 88.1 <= lon <= 88.6):
            return "coordinates outside Kolkata"
        if rec["lat"] is None or abs(lat - rec["lat"]) > 1e-5 or abs(lon - rec["lon"]) > 1e-5:
            return "destination differs from record"
        return None
    if u.path == "/maps/search/":
        q = qs.get("query", [""])[0]
        return None if rec["name"] in q else "query lacks pandal name"
    return "unknown maps path"


def main():
    raw = load(RAW, [])
    pages = {p["slug"]: p for p in load(PAGES, [])}
    additions = load(ADDITIONS, [])
    walks = load(WALKS, {})
    overrides = load(OVERRIDES, {})
    overrides.pop("_doc", None)
    stations = load(STATIONS, [])
    if not SITEMAP.exists():
        urllib.request.urlretrieve("https://www.pujomap.com/sitemap.xml", SITEMAP)
    sitemap = set(re.findall(r"pujomap\.com/p/([a-z0-9-]+)</loc>", SITEMAP.read_text(encoding="utf-8")))
    today = datetime.now(timezone.utc).date().isoformat()
    st_by_name = {s["name"].lower(): s for s in stations}

    def station(name):
        if not name:
            return None
        return st_by_name.get(STATION_ALIASES.get(name, name).lower())

    def nearest_station(lat, lon):
        return min(stations, key=lambda s: hv(lat, lon, s["lat"], s["lon"]))

    # ---------------- 1. dedupe the export ----------------
    groups = {}
    for r in raw:
        groups.setdefault(norm_name(r["name"]), []).append(r)
    kept, dedup_notes = [], []
    for key, g in groups.items():
        if len(g) == 1:
            kept.append(g[0])
            continue
        near = DEDUP_KEEP_NEAR.get(key, "")
        win = next((r for r in g if (r.get("nearStreet") or "").lower() == near.lower()), g[0])
        kept.append(win)
        dedup_notes.append(f"{win['name']}: kept nearStreet={win.get('nearStreet')!r}; dropped "
                           + "; ".join(f"{o.get('nearStreet')!r} ({o['geocodeMethod']})" for o in g if o is not win))

    # ---------------- 2. normalise into one candidate list ----------------
    cands = []
    claimed = set(PAGE_MATCHES.keys())
    for r in kept:
        name = r["name"].strip()
        slug = match_source_slug(name, sitemap, claimed)
        if slug:
            claimed.add(slug)
        cands.append({
            "origin": "export", "name": name, "nameBn": r.get("nameBn"),
            "alternateNames": [a for a in (r.get("alsoKnownAs"), r.get("formerName")) if a],
            "neighbourhood": r.get("neighbourhood"), "nearStreet": r.get("nearStreet"),
            "zone": r["zone"], "region": None, "lat": r["lat"], "lon": r["lon"],
            "geocodeMethod": r.get("geocodeMethod", ""), "slugs": [s for s in [slug] if s],
            "dirMetro": (r.get("nearestMetro") or {}).get("name"),
            "dirMetroM": (r.get("nearestMetro") or {}).get("distanceMeters"), "osmRef": None, "corrob": None,
        })
    by_id = {slugify(c["name"]): c for c in cands}
    updated = Counter()
    for page_slug, rid in PAGE_MATCHES.items():
        if rid in by_id and page_slug not in by_id[rid]["slugs"]:
            by_id[rid]["slugs"].append(page_slug)
            updated["linked reference page"] += 1

    new_records, unresolved = [], []
    for a in additions:
        if a["slug"] in PAGE_MATCHES or a["slug"] in {s for c in cands for s in c["slugs"]}:
            continue
        pg = pages.get(a["slug"], {})
        lat, lon, method = a.get("lat"), a.get("lon"), a.get("geocodeMethod")
        corrob = None
        if lat is not None and pg.get("_matchLat") is not None:
            corrob = round(hv(lat, lon, pg["_matchLat"], pg["_matchLon"]))
        c = {
            # nameBn deliberately null: every Bengali string on a reference page belongs to "nearby pandal"
            # links, not to the page's own pandal, so it cannot be attributed reliably.
            "origin": "page", "name": a["name"], "nameBn": None, "alternateNames": [],
            "neighbourhood": a.get("neighbourhood"), "nearStreet": a.get("street"), "zone": None,
            "region": a.get("region"), "lat": lat, "lon": lon, "geocodeMethod": method or "unresolved",
            "slugs": [a["slug"]], "dirMetro": a.get("directoryMetro"), "dirMetroM": None,
            "osmRef": a.get("osmRef"), "corrob": corrob, "osmMatchedName": a.get("osmMatchedName"),
        }
        cands.append(c)
        new_records.append(c)
        if lat is not None:
            # say exactly how the pin was obtained: OSM landmark/feature + independent check distance
            c["geocodeMethod"] = f"osm-{'feature' if method == 'osm' else 'landmark'}" + (f"+checked-{corrob}m" if corrob is not None else "")

    # ---------------- 3. build records ----------------
    records, review = [], []
    existing_for_zone = [c for c in cands if c["origin"] == "export"]
    for c in cands:
        name = c["name"]
        notes = []
        # neighbourhood normalisation (derive from street reference when missing)
        neigh = c["neighbourhood"]
        if not neigh and c["nearStreet"]:
            hit = next((l for l in LOCALITY_FROM_STREET if l.lower() in c["nearStreet"].lower()), None)
            if hit:
                neigh = hit
                if c["origin"] == "export":
                    updated["neighbourhood derived from street reference"] += 1

        # ---- location ----
        lat, lon = c["lat"], c["lon"]
        if c["origin"] == "export":
            accuracy = "approximate" if c["geocodeMethod"] in ANCHOR_METHODS else "exact"
        else:
            if lat is None:
                accuracy = "unknown"
                notes.append("no OpenStreetMap feature found for this pandal or its stated site")
            elif c["corrob"] is not None and c["corrob"] <= CORROBORATE_EXACT_M and c["geocodeMethod"].startswith("osm-"):
                accuracy = "exact"
            elif c["corrob"] is not None and c["corrob"] <= CORROBORATE_APPROX_M:
                accuracy = "approximate"
                notes.append(f"OSM-derived pin ({c.get('osmMatchedName')}) is {c['corrob']} m from the directory's position — approximate")
            else:
                notes.append(f"OSM match '{c.get('osmMatchedName')}' is {c['corrob']} m from the directory's position — rejected")
                lat = lon = None
                accuracy = "unknown"
        if lat is not None and not (22.3 <= lat <= 22.8 and 88.1 <= lon <= 88.6):
            notes.append(f"coordinates out of range ({lat},{lon}) — removed")
            lat = lon = None
            accuracy = "unknown"

        # ---- zone ----
        fallback = c["zone"]
        if fallback is None:
            if lat is not None:
                nn = sorted(existing_for_zone, key=lambda e: hv(lat, lon, e["lat"], e["lon"]))[:5]
                fallback = Counter(e["zone"] for e in nn).most_common(1)[0][0]
            else:
                fallback = next((z for k, z in LOCALITY_ZONE.items() if k in f"{neigh or ''} {c['nearStreet'] or ''}".lower()), None)
        zone = zone_for(f"{name} {neigh or ''} {c['nearStreet'] or ''}", c["region"], fallback)
        if zone is None:
            zone = "I"
            notes.append("zone could not be established — defaulted to North & Central")
        if c["origin"] == "export" and zone != c["zone"]:
            updated[f"zone {c['zone']} → {zone}"] += 1

        # ---- metro ----
        st = station(c["dirMetro"])
        if c["dirMetro"] and st is None:
            notes.append(f"directory's metro {c['dirMetro']!r} not found among operational OSM stations")
        if st is None and lat is not None and accuracy != "unknown":
            st = nearest_station(lat, lon)  # straight-line nearest, derived from our pin
        straight_m = round(hv(lat, lon, st["lat"], st["lon"])) if (st and lat is not None) else None
        if st and lat is not None:
            nn = nearest_station(lat, lon)
            nn_d = hv(lat, lon, nn["lat"], nn["lon"])
            if nn["name"] != st["name"] and straight_m - nn_d > 400:
                notes.append(f"straight-line nearest is {nn['name']} ({nn_d/1000:.1f} km) vs listed {st['name']} ({straight_m/1000:.1f} km)")

        walk = walks.get(f"{slugify(name)}@{round(lat, 6)},{round(lon, 6)}") if (lat is not None and accuracy == "exact") else None
        walk_to_listed = practical = None
        if walk:
            routed = [w for w in walk if w["walkM"] is not None]
            if st:
                walk_to_listed = next((w for w in routed if w["station"] == st["name"]), None)
            if routed:
                practical = min(routed, key=lambda w: w["walkM"])
                if practical["snapM"] > 150:
                    notes.append(f"walking route snapped {practical['snapM']} m to the nearest footpath — distances less reliable")
                    walk_to_listed = practical = None
        practical_st = station(practical["station"]) if practical else None
        if practical and st and practical["station"] != st["name"]:
            notes.append(f"shortest walk is from {practical['station']} ({practical['walkM']/1000:.1f} km) rather than listed {st['name']}")

        # ---- status ----
        if accuracy == "unknown":
            status = "name_only"
        elif accuracy == "approximate":
            status = "name_only" if c["origin"] == "export" else "partially_verified"
        elif any("disagree" in n or "not found" in n or "rejected" in n for n in notes):
            status = "needs_review"
        elif c["origin"] == "export" and c["geocodeMethod"] in ("osm", "verified") and st is not None:
            status = "verified"
        elif c["origin"] == "page" and c["corrob"] is not None and c["corrob"] <= CORROBORATE_EXACT_M and st is not None:
            status = "verified"
        else:
            status = "partially_verified"

        vf = {"name"}
        if neigh:
            vf.add("neighbourhood")
        if c["nearStreet"]:
            vf.add("nearStreet")
        if c["nameBn"]:
            vf.add("nameBn")
        if accuracy == "exact":
            vf.add("coordinates")
        if c["corrob"] is not None and c["corrob"] <= CORROBORATE_APPROX_M:
            vf.add("coordinatesCorroborated")
        if st and accuracy != "unknown":
            vf.update({"nearestMetro", "metroStationCoordinates", "metroLines", "metroStraightLine"})
        if walk_to_listed or practical:
            vf.add("walkingRoute")

        sources = []
        if c["origin"] == "export":
            sources.append(DATA_URL)
        sources += [f"https://www.pujomap.com/p/{s}" for s in c["slugs"]]
        if c["osmRef"]:
            sources.append(f"https://www.openstreetmap.org/{c['osmRef']}")
        if walk_to_listed or practical:
            sources.append("https://routing.openstreetmap.de/")
        sources.append(OSM_COPYRIGHT)

        rid = slugify(name)
        rec = {
            "id": rid,
            "sourceSlug": c["slugs"][0] if c["slugs"] else None,
            "origin": "odbl_export" if c["origin"] == "export" else "reference_page_osm_geocoded",
            "name": name,
            "nameBn": c["nameBn"],
            "alternateNames": c["alternateNames"],
            "neighbourhood": neigh,
            "zone": zone,
            "zoneName": ZONE_NAMES[zone],
            "zoneShort": ZONE_SHORT[zone],
            "nearStreet": c["nearStreet"],
            "address": None,
            "lat": round(lat, 6) if lat is not None else None,
            "lon": round(lon, 6) if lon is not None else None,
            "locationAccuracy": accuracy,
            "geocodeMethod": c["geocodeMethod"],
            "nearestMetro": st["name"] if st and accuracy != "unknown" else None,
            "directoryListedMetro": c["dirMetro"],
            "metroLine": st["lines"] if st and accuracy != "unknown" else [],
            "metroStationLat": st["lat"] if st and accuracy != "unknown" else None,
            "metroStationLon": st["lon"] if st and accuracy != "unknown" else None,
            "metroStraightLineKm": round(straight_m / 1000, 2) if straight_m is not None and accuracy != "unknown" else None,
            "distanceFromMetroKm": round(walk_to_listed["walkM"] / 1000, 2) if walk_to_listed else None,
            "walkingTimeFromMetroMinutes": round(walk_to_listed["walkS"] / 60) if walk_to_listed else None,
            "practicalMetro": practical["station"] if practical else None,
            "practicalMetroLine": practical_st["lines"] if practical_st else [],
            "practicalWalkKm": round(practical["walkM"] / 1000, 2) if practical else None,
            "practicalWalkMinutes": round(practical["walkS"] / 60) if practical else None,
            "walkingRouteSource": ROUTER if (walk_to_listed or practical) else None,
            "googleMapsPlaceUrl": None,
            "googleMapsDirectionsUrl": directions_url(name, neigh, lat, lon, accuracy == "exact"),
            "directionsIsApproximate": accuracy != "exact",
            "verificationStatus": status,
            "verifiedFields": sorted(vf),
            "reviewNotes": " | ".join(notes) if notes else None,
            "sourceUrls": sources,
            "lastVerifiedAt": today,
            "puja2026Status": "unconfirmed",
            "imageUrl": None,
            "theme": None,
        }
        # manual corrections always win and are never overwritten by an import
        for k, v in (overrides.get(rid) or {}).items():
            rec[k] = v
        if overrides.get(rid):
            rec["verifiedFields"] = sorted(set(rec["verifiedFields"]) | {"manualCorrection"})
        records.append(rec)

    ids = Counter(r["id"] for r in records)
    dup_ids = [i for i, n in ids.items() if n > 1]
    if dup_ids:
        raise SystemExit(f"duplicate ids: {dup_ids}")
    records.sort(key=lambda r: r["name"].lower())

    # ---------------- 4. link validation ----------------
    link_fail = {}
    for r in records:
        err = validate_link(r["googleMapsDirectionsUrl"], r)
        if err:
            link_fail[r["id"]] = err

    OUT_JSON.write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_TS.write_text(
        "// Generated by scripts/build_dataset.py — do not edit by hand (use backend/data/manual_overrides.json).\n"
        "// Sources: pujomap.com ODbL export + reference pages (facts only) + OpenStreetMap. See /app/IMPORT_REPORT.md.\n"
        'import type { Pandal } from "@/lib/types";\n\nexport const PANDALS: Pandal[] = '
        + json.dumps(records, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )

    # ---------------- 5. reports ----------------
    n = len(records)
    cnt = Counter(r["verificationStatus"] for r in records)
    acc = Counter(r["locationAccuracy"] for r in records)
    zc = Counter(r["zone"] for r in records)
    with_metro = sum(1 for r in records if r["nearestMetro"])
    walked = sum(1 for r in records if r["distanceFromMetroKm"] is not None or r["practicalWalkKm"] is not None)
    practical_diff = sum(1 for r in records if r["practicalMetro"] and r["practicalMetro"] != r["nearestMetro"])
    new_ids = {slugify(c["name"]) for c in new_records}
    new_recs = [r for r in records if r["id"] in new_ids]
    ne_new = [r for r in new_recs if r["zone"] == "V"]
    review = [r for r in records if r["verificationStatus"] in ("name_only", "needs_review") or r["reviewNotes"]]

    def line(r):
        return f"| {r['name']} | {r['neighbourhood'] or '—'} | {ZONE_SHORT[r['zone']]} | {r['verificationStatus']} | {r['locationAccuracy']} | {r['nearestMetro'] or '—'} |"

    rep = [
        "# PujoPath — data import & quality audit", f"_Generated {today} by `scripts/build_dataset.py`_", "",
        "## Sources and access",
        f"- **Pujo Map ODbL export** `{DATA_URL}`: {len(raw)} rows (unchanged since first import). Positions are OSM-derived or hand-placed; licence ODbL 1.0.",
        f"- **Pujo Map public pages** (sitemap: {len(sitemap)} pandal pages). Pages for pandals absent from the export were read for *facts* "
        "(name, locality, street reference, the directory's named metro). Their coordinates were **not copied** — the directory states those "
        "positions came from a third-party listing it cannot sublicense. They were used only to *check* our independently derived pins.",
        "- **OpenStreetMap**: Nominatim + Overpass for positions of the page-only pandals; Overpass for metro stations and line membership.",
        f"- **Pedestrian routing**: {ROUTER} — walking distance/time from each precisely-located pandal to its 3 straight-line-nearest stations.",
        "- **Google Maps**: not queried programmatically (no API key configured; scraping Google is not permitted). Directions use Google's public URL scheme only; no place IDs.",
        "- **Official Kolkata Metro site** (mtp.indianrailways.gov.in): timed out from the build server, so station names/lines are cross-checked against OSM only.",
        "",
        "## Phase 8 — Salt Lake, New Town, Rajarhat & North-East",
        f"- Reference pages not represented in the export: **{len(pages)}**",
        f"- Duplicates of existing records under another spelling (linked as sources, IDs kept): **{len(PAGE_MATCHES)}** — " + ", ".join(f"{k} → {v}" for k, v in PAGE_MATCHES.items()),
        f"- **New pandals added: {len(new_recs)}** (city-wide), of which **{len(ne_new)}** in Salt Lake / New Town / North-East",
        f"  - with a corroborated exact pin: {sum(1 for r in new_recs if r['locationAccuracy']=='exact')} · approximate pin: {sum(1 for r in new_recs if r['locationAccuracy']=='approximate')} · no pin (searchable, name-search directions): {sum(1 for r in new_recs if r['locationAccuracy']=='unknown')}",
        f"- Existing records updated: **{sum(updated.values())}** — " + "; ".join(f"{k}: {v}" for k, v in sorted(updated.items())),
        "- New Town Action Areas II & III and Rajarhat proper: **no pandal pages exist in the reference directory** and no puja feature is mapped in OSM, "
        "so none were added — we do not assume every block holds a registered puja.",
        "",
        "## Phase 9 — audit of the whole dataset",
        "| Metric | Count |", "|---|---|",
        f"| Rows read (export {len(raw)} + page-only {len(pages)}) | {len(raw) + len(pages)} |",
        f"| True duplicates removed | {len(raw) - len(kept)} in export + {len(PAGE_MATCHES)} page↔record |",
        f"| **Unique pandals in the dataset** | **{n}** |",
        "| Verified street addresses | 0 — sources give street references, not postal addresses |",
        f"| Verified (exact) coordinates | {acc['exact']} |",
        f"| Approximate pins (shown hollow) | {acc['approximate']} |",
        f"| No coordinates (list + search only) | {acc['unknown']} |",
        f"| Nearest metro attached with verified station coordinates/lines | {with_metro} |",
        f"| Routed pedestrian distance (OSRM foot) | {walked} |",
        f"| … where the shortest walk is from a different station than the listed one | {practical_diff} |",
        f"| Directions links passing structural validation | {n - len(link_fail)} / {n} |",
        f"| Status verified | {cnt['verified']} |", f"| Status partially_verified | {cnt['partially_verified']} |",
        f"| Status name_only | {cnt['name_only']} |", f"| Status needs_review | {cnt['needs_review']} |",
        "| Confirmed for Puja 2026 by organisers | 0 — no source states per-pandal participation |",
        "", "**Zones:** " + ", ".join(f"{ZONE_NAMES[z]} {zc[z]}" for z in sorted(zc)), "",
        "A Directions link that opens is not proof its destination is right. Coordinate links are validated against the record's own pin; "
        "name-search links are validated to contain the pandal name — the user must confirm the result in Google Maps (the UI says so).",
        "",
        "**Metro distances corrected:** earlier builds labelled the export's `distanceMeters` as a walking distance. The directory's own pages state it is measured in a "
        "straight line, so it now lives in `metroStraightLineKm`; `distanceFromMetroKm`/`walkingTimeFromMetroMinutes` hold only routed walking values.",
        "",
        "## Export duplicate decisions",
    ] + [f"- {x}" for x in dedup_notes] + [
        "", "## Link validation failures", *([f"- {k}: {v}" for k, v in link_fail.items()] or ["- none"]),
        "", "## Re-running",
        "```bash\ncd /app/scripts\npython3 fetch_metro_osm.py        # OSM stations + lines\npython3 fetch_pujomap_pages.py    # facts from pages missing from the export (cached)\n"
        "python3 geocode_additions_osm.py && python3 osm_name_pass.py   # OSM positions for them\npython3 build_dataset.py          # build once to get pins\n"
        "python3 route_metro_walks.py     # pedestrian routes (cached)\npython3 build_dataset.py          # final build + reports\n```",
        "Hand corrections go in `backend/data/manual_overrides.json` (keyed by id) and always win over imports.", "",
    ]
    OUT_REPORT.write_text("\n".join(rep), encoding="utf-8")

    rv = ["# PujoPath — manual review list", f"_Generated {today}. {len(review)} records need a human check._", "",
          "| Pandal | Neighbourhood | Zone | Status | Pin | Missing / uncertain fields | Reason |", "|---|---|---|---|---|---|---|"]
    for r in sorted(review, key=lambda r: (r["verificationStatus"], r["name"])):
        missing = []
        if r["locationAccuracy"] != "exact":
            missing.append("exact coordinates")
        if not r["nearestMetro"]:
            missing.append("nearest metro")
        if r["distanceFromMetroKm"] is None and r["practicalWalkKm"] is None:
            missing.append("walking distance")
        missing.append("street address")
        missing.append("2026 participation")
        reason = r["reviewNotes"] or ("pin is a neighbourhood anchor in the source" if r["locationAccuracy"] == "approximate" else "")
        rv.append(f"| {r['name']} | {r['neighbourhood'] or '—'} | {r['zoneShort']} | {r['verificationStatus']} | {r['locationAccuracy']} | {', '.join(missing)} | {reason.replace('|', '/')} |")
    rv += ["", "_Every record lacks a verified postal address and organiser-confirmed 2026 participation; those two are listed for completeness._"]
    OUT_REVIEW.write_text("\n".join(rv), encoding="utf-8")

    print(f"unique pandals: {n} | new: {len(new_recs)} (NE {len(ne_new)}) | updated: {sum(updated.values())} | review: {len(review)}")
    print(f"accuracy: {dict(acc)} | status: {dict(cnt)} | zones: {dict(zc)} | walked: {walked} | link failures: {len(link_fail)}")


if __name__ == "__main__":
    main()
