"""Pedestrian routing from each precisely-located pandal to its nearby metro stations.

Service: FOSSGIS OSRM foot profile (https://routing.openstreetmap.de), OSM data,
light use only — one table request per pandal, >= 1 s apart, cached.

For each pandal with an EXACT pin we take the 3 stations nearest by straight
line and ask the router for real walking distance/duration from the pandal to
each. The station with the shortest walk is the "practical" station; it can
differ from the straight-line nearest (rail lines, canals, the Bypass...).

Approximate (landmark/neighbourhood-anchored) pins are NOT routed — a walking
distance from a guessed point would look precise without being so.

Input : frontend/src/data/pandals.json (+ metro_stations.json)
Output: backend/data/walk_cache.json  { "<id>@<lat>,<lon>": [{station, straightM, walkM, walkS}, ...] }
"""
import json
import time
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

import requests

ROOT = Path("/app")
DATASET = ROOT / "frontend/src/data/pandals.json"
STATIONS = ROOT / "frontend/src/data/metro_stations.json"
CACHE = ROOT / "backend/data/walk_cache.json"
URL = "https://routing.openstreetmap.de/routed-foot/table/v1/foot/"
HEADERS = {"User-Agent": "PujoPath/1.0 (pandal-to-metro walking distances; OSM-attributed)"}


def hv(a, b, c, d):
    a, b, c, d = map(radians, (a, b, c, d))
    h = sin((c - a) / 2) ** 2 + cos(a) * cos(c) * sin((d - b) / 2) ** 2
    return 6371000 * 2 * asin(sqrt(h))


def main():
    rows = json.loads(DATASET.read_text(encoding="utf-8"))
    stations = json.loads(STATIONS.read_text(encoding="utf-8"))
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    todo = [r for r in rows if r.get("lat") is not None and r.get("locationAccuracy") == "exact"]
    keys = {f"{r['id']}@{r['lat']},{r['lon']}" for r in todo}
    print(f"{len(todo)} exact pins to route ({len(keys & cache.keys())} cached)")
    for i, r in enumerate(todo):
        key = f"{r['id']}@{r['lat']},{r['lon']}"
        if key in cache:
            continue
        near = sorted(stations, key=lambda s: hv(r["lat"], r["lon"], s["lat"], s["lon"]))[:3]
        coords = ";".join([f"{r['lon']},{r['lat']}"] + [f"{s['lon']},{s['lat']}" for s in near])
        for attempt in range(6):
            try:
                resp = requests.get(
                    URL + coords,
                    params={"sources": "0", "annotations": "distance,duration"},
                    headers=HEADERS,
                    timeout=40,
                )
                if resp.status_code == 200 and resp.json().get("code") == "Ok":
                    j = resp.json()
                    cache[key] = [
                        {
                            "station": s["name"],
                            "straightM": round(hv(r["lat"], r["lon"], s["lat"], s["lon"])),
                            "walkM": None if j["distances"][0][k + 1] is None else round(j["distances"][0][k + 1]),
                            "walkS": None if j["durations"][0][k + 1] is None else round(j["durations"][0][k + 1]),
                            # how far the router had to snap the pandal pin onto a footpath
                            "snapM": round(j["sources"][0].get("distance", 0)),
                        }
                        for k, s in enumerate(near)
                    ]
                    break
                print(f"  {r['id']}: HTTP {resp.status_code}, backing off")
                if resp.status_code == 429:
                    time.sleep(60)  # the service asked us to slow down
                    continue
            except Exception as exc:  # noqa: BLE001
                print(f"  {r['id']}: {exc}, retry")
            time.sleep(3)
        time.sleep(3.0)
        if (i + 1) % 10 == 0:
            CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
            print(f"  {i + 1}/{len(todo)}")
    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    print(f"routed {len(cache)} pandals -> {CACHE}")


if __name__ == "__main__":
    main()
