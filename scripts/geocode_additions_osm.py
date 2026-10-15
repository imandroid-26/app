"""Independently locate the pandals that exist on the reference directory but are
absent from its ODbL export, using ONLY OpenStreetMap (Nominatim search).

We never copy the directory's coordinates for these records (they are not
licensed for reuse). Acceptance rules, strictest first:

  osm            an OSM object whose name matches the pandal itself (e.g. a
                 family-puja house "... Bari" mapped as a building)  -> exact
  osm-landmark   the named park / ground / street the directory gives as the
                 pandal's site (e.g. "AD Park, Salt Lake")             -> approximate
  (rejected)     anything coarser than a street (suburb, city, block area)
                 or outside the expected locality                     -> no pin

Polite: <= 1 request/second, cached in backend/data/geocode_cache.json.
Output: backend/data/additions_geocoded.json
"""
import json
import re
import time
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

import requests

ROOT = Path("/app")
PAGES = ROOT / "backend/data/pujomap_pages.json"
DATASET = ROOT / "frontend/src/data/pandals.json"
CACHE = ROOT / "backend/data/geocode_cache.json"
OUT = ROOT / "backend/data/additions_geocoded.json"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "PujoPath/1.0 (Durga Puja pandal directory; OSM-attributed)"}
VIEWBOX = "88.15,22.75,88.60,22.38"  # greater Kolkata + Howrah + New Town

COARSE_TYPES = {"city", "town", "suburb", "county", "state", "state_district", "village",
                "postcode", "administrative", "neighbourhood", "quarter", "city_district", "hamlet"}
LANDMARK_CLASSES = {"leisure", "amenity", "building", "historic", "tourism", "highway", "landuse", "place"}
STOP = {"durga", "puja", "pujo", "sarbojanin", "the", "of", "and", "block", "club", "salt", "lake",
        "kolkata", "road", "street", "park", "part", "1", "2", "new", "town", "sangha", "samiti", "samity"}


def hv(a, b, c, d):
    a, b, c, d = map(radians, (a, b, c, d))
    h = sin((c - a) / 2) ** 2 + cos(a) * cos(c) * sin((d - b) / 2) ** 2
    return 6371000 * 2 * asin(sqrt(h))


def toks(s):
    s = (s or "").lower().replace("palli", "pally").replace("bari", " bari")
    return set(re.sub(r"[^a-z0-9 ]", " ", s).split()) - STOP


def search(q, cache):
    if q in cache:
        return cache[q]
    time.sleep(1.1)
    r = requests.get(
        NOMINATIM,
        params={"q": q, "format": "jsonv2", "limit": 5, "viewbox": VIEWBOX, "bounded": 1, "addressdetails": 1},
        headers=HEADERS,
        timeout=30,
    )
    res = r.json() if r.status_code == 200 else []
    cache[q] = res
    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    return res


def locality_anchor(neigh, existing):
    """Centroid of existing ODbL records in the same neighbourhood (for sanity checks)."""
    pts = [(r["lat"], r["lon"]) for r in existing
           if r.get("lat") is not None and (r.get("neighbourhood") or "").lower() == (neigh or "").lower()]
    if not pts:
        return None
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def main():
    pages = json.loads(PAGES.read_text(encoding="utf-8"))
    existing = json.loads(DATASET.read_text(encoding="utf-8"))
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    existing_slugs = {r.get("sourceSlug") for r in existing}
    out = []
    for p in pages:
        if p["slug"] in existing_slugs:
            continue
        neigh = p.get("neighbourhood") or ""
        street = p.get("street") or ""
        anchor = locality_anchor(neigh, existing)
        name_t = toks(p["name"])
        street_t = toks(street)
        best = None

        queries = [f"{p['name']}, {neigh}, Kolkata" if neigh else f"{p['name']}, Kolkata"]
        if street and street.lower() != neigh.lower():
            queries.append(f"{street}, {neigh}" if neigh and neigh.lower() not in street.lower() else street)
        for q in queries:
            for res in search(q, cache):
                cls, typ = res.get("category") or res.get("class"), res.get("type")
                lat, lon = float(res["lat"]), float(res["lon"])
                rname = res.get("name") or ""
                disp = (res.get("display_name") or "").lower()
                # must sit in the expected locality
                if anchor and hv(lat, lon, *anchor) > 3000:
                    continue
                if not anchor and neigh and neigh.lower() not in disp:
                    continue
                if typ in COARSE_TYPES or cls not in LANDMARK_CLASSES:
                    continue
                rt = toks(rname)
                if name_t and len(name_t & rt) >= max(1, min(2, len(name_t))) and cls != "highway":
                    cand = ("osm", lat, lon, res, q)
                elif street_t and street_t & rt:
                    cand = ("osm-landmark", lat, lon, res, q)
                else:
                    continue
                if best is None or (best[0] != "osm" and cand[0] == "osm"):
                    best = cand
            if best and best[0] == "osm":
                break

        rec = dict(p)
        rec.pop("_matchLat", None)
        rec.pop("_matchLon", None)
        if best:
            method, lat, lon, res, q = best
            rec.update({
                "lat": round(lat, 6), "lon": round(lon, 6), "geocodeMethod": method,
                "osmRef": f"{res.get('osm_type')}/{res.get('osm_id')}",
                "osmMatchedName": res.get("name"), "osmQuery": q,
            })
        else:
            rec.update({"lat": None, "lon": None, "geocodeMethod": "unresolved", "osmRef": None,
                        "osmMatchedName": None, "osmQuery": " | ".join(queries)})
        out.append(rec)
        print(f"{rec['geocodeMethod']:13} {p['slug']:45} -> {rec.get('osmMatchedName')}")
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter
    print(Counter(r["geocodeMethod"] for r in out))


if __name__ == "__main__":
    main()
