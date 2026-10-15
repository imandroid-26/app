"""Second OSM pass: Overpass name search (distinctive tokens) for additions that
Nominatim could not place, or placed only on a long street. The directory's
position is used only to bound the search area (2.5 km); the coordinate kept is
OpenStreetMap's. Updates backend/data/additions_geocoded.json in place."""
import json, re, time
from pathlib import Path
import requests
ROOT = Path("/app")
ADD = ROOT / "backend/data/additions_geocoded.json"
PAGES = {p["slug"]: p for p in json.loads((ROOT / "backend/data/pujomap_pages.json").read_text())}
H = {"User-Agent": "PujoPath/1.0 (pandal directory; OSM-attributed)"}
GENERIC = {"durga","puja","pujo","sarbojanin","the","of","and","block","club","sangha","samiti","samity","pally","palli",
           "part","durgotsab","durgotsav","sadharan","maha","sporting","association","brinda","baroary","united","1","2","new","town","er"}
def distinctive(name):
    t = [w for w in re.sub(r"[^a-z0-9 ]", " ", name.lower()).split() if w not in GENERIC and len(w) > 2]
    return t[:3]
adds = json.loads(ADD.read_text())
TRIED = ROOT / "backend/data/name_pass_tried.json"
tried = set(json.loads(TRIED.read_text())) if TRIED.exists() else set()
for rec in adds:
    if rec["geocodeMethod"] == "osm" or rec["slug"] in ("kumartuli-park","pathuriaghata-5er-pally","players-corner","taltala-childrens-park-14-palli"):
        continue
    if rec["slug"] in tried:
        continue
    pg = PAGES[rec["slug"]]
    toks = distinctive(rec["name"])
    if not toks or pg.get("_matchLat") is None:
        continue
    rx = ".*".join(toks)
    q = f'[out:json][timeout:20];nwr["name"~"{rx}",i](around:2500,{pg["_matchLat"]},{pg["_matchLon"]});out center tags 10;'
    els, ok = [], False
    for url in ["https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter"]:
        try:
            r = requests.post(url, data={"data": q}, headers=H, timeout=25)
            if r.status_code == 200:
                els, ok = r.json().get("elements", []), True
                break
        except Exception:
            pass
        time.sleep(5)
    if not ok:
        print(f"skip   {rec['slug']} (overpass unavailable)")
    # prefer buildings/POIs over streets
    els = [e for e in els if "highway" not in e.get("tags", {}) and "name" in e.get("tags", {})]
    if els:
        e = els[0]; c = e.get("center", e)
        rec.update({"lat": round(c["lat"], 6), "lon": round(c["lon"], 6), "geocodeMethod": "osm",
                    "osmRef": f"{e['type']}/{e['id']}", "osmMatchedName": e["tags"]["name"], "osmQuery": f"overpass name~{rx}"})
        print(f"found  {rec['slug']:42} -> {e['tags']['name']} ({e['type']}/{e['id']})")
    if ok:
        tried.add(rec["slug"])
    ADD.write_text(json.dumps(adds, ensure_ascii=False, indent=1))
    TRIED.write_text(json.dumps(sorted(tried)))
    time.sleep(1)
ADD.write_text(json.dumps(adds, ensure_ascii=False, indent=1))
from collections import Counter
print(Counter(r["geocodeMethod"] for r in adds))
