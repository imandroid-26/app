"""Fetch the reference directory's public pandal pages that are NOT matched to a
record in the ODbL export, and extract their factual fields.

Used for two things only:
  1. Matching: a page whose position lies within MATCH_M metres of an existing
     record (and whose name is compatible) is the same pandal -> we record its
     page URL as a source. Page coordinates are used for this comparison only.
  2. Discovery: pages with no matching record are genuinely missing pandals.
     We keep their FACTS (name, locality, street reference, the directory's
     named nearest metro) with attribution. We do NOT copy their coordinates:
     the directory states that positions absent from its ODbL export came from a
     third-party listing it cannot sublicense. Positions for these records are
     derived independently from OpenStreetMap by build_dataset.py, or left null.

Polite: sequential, 1.5 s apart, cached under backend/data/pages/.
Output: backend/data/pujomap_pages.json
"""
import json
import re
import time
from pathlib import Path

import requests

ROOT = Path("/app")
PAGES = ROOT / "backend/data/pages"
SITEMAP = ROOT / "backend/data/pujomap_sitemap.xml"
DATASET = ROOT / "frontend/src/data/pandals.json"
OUT = ROOT / "backend/data/pujomap_pages.json"
HEADERS = {"User-Agent": "PujoPath/1.0 (reference lookup; credits Pujo Map + OSM)"}


def text_of(html: str) -> str:
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", html, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = t.replace("&amp;", "&").replace("&#39;", "'").replace("&#160;", " ")
    return re.sub(r"\s+", " ", t).strip()


def parse(slug: str, html: str) -> dict:
    ld = {}
    for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html, re.S):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        for node in data.get("@graph", [data]):
            if node.get("@type") == "TouristAttraction":
                ld = node
    t = text_of(html)
    crumbs = re.search(r"Pujo Map › (.+?) › (.+?) › ", t)
    metro = re.search(r"Nearest metro (.+?) metro — ([\d.]+) (km|m)", t)
    bn = None  # see build_dataset.py: page Bengali strings belong to nearby-pandal links
    addr = ld.get("address", {})
    geo = ld.get("geo", {})
    dist_km = None
    if metro:
        v = float(metro.group(2))
        dist_km = v if metro.group(3) == "km" else v / 1000
    return {
        "slug": slug,
        "url": f"https://www.pujomap.com/p/{slug}",
        "name": ld.get("name"),
        "nameBn": None,
        "region": crumbs.group(1) if crumbs else None,
        "neighbourhood": addr.get("addressLocality") or (crumbs.group(2) if crumbs else None),
        "street": addr.get("streetAddress"),
        "directoryMetro": metro.group(1).strip() if metro else None,
        "directoryMetroStraightKm": dist_km,  # page states this is straight-line
        "_matchLat": geo.get("latitude"),
        "_matchLon": geo.get("longitude"),
    }


def main() -> None:
    PAGES.mkdir(parents=True, exist_ok=True)
    xml = SITEMAP.read_text(encoding="utf-8")
    slugs = sorted(set(re.findall(r"pujomap\.com/p/([a-z0-9-]+)</loc>", xml)))
    used = {r["sourceSlug"] for r in json.loads(DATASET.read_text(encoding="utf-8")) if r.get("sourceSlug")}
    todo = [s for s in slugs if s not in used]
    print(f"{len(todo)} unmatched pages to read")
    out = []
    for i, slug in enumerate(todo):
        cache = PAGES / f"{slug}.html"
        if not cache.exists():
            r = requests.get(f"https://www.pujomap.com/p/{slug}", headers=HEADERS, timeout=30)
            if r.status_code != 200:
                print(f"  {slug}: HTTP {r.status_code}")
                continue
            cache.write_text(r.text, encoding="utf-8")
            time.sleep(1.5)
        out.append(parse(slug, cache.read_text(encoding="utf-8")))
        if (i + 1) % 20 == 0:
            print(f"  {i + 1}/{len(todo)}")
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(out)} page records -> {OUT}")


if __name__ == "__main__":
    main()
