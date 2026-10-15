"""Read-only API over the generated pandal dataset (same file the frontend bundles)."""
import json
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

DATA = Path(__file__).resolve().parents[2] / "frontend/src/data/pandals.json"

router = APIRouter()


class PandalOut(BaseModel):
    id: str
    name: str
    nameBn: Optional[str] = None
    neighbourhood: Optional[str] = None
    zone: str
    zoneName: str
    lat: float
    lon: float
    locationAccuracy: str
    nearestMetro: Optional[str] = None
    metroLine: List[str] = []
    distanceFromMetroKm: Optional[float] = None
    googleMapsDirectionsUrl: str
    verificationStatus: str


class PandalStats(BaseModel):
    total: int
    exactPins: int
    withMetro: int
    byStatus: dict


def _load() -> list:
    return json.loads(DATA.read_text(encoding="utf-8"))


@router.get("/pandals", response_model=List[PandalOut])
async def list_pandals(zone: Optional[str] = None):
    rows = _load()
    if zone:
        rows = [r for r in rows if r["zone"] == zone]
    return rows


@router.get("/pandals/stats", response_model=PandalStats)
async def pandal_stats():
    rows = _load()
    by_status: dict = {}
    for r in rows:
        by_status[r["verificationStatus"]] = by_status.get(r["verificationStatus"], 0) + 1
    return PandalStats(
        total=len(rows),
        exactPins=sum(1 for r in rows if r["locationAccuracy"] == "exact"),
        withMetro=sum(1 for r in rows if r.get("metroStationLat") is not None),
        byStatus=by_status,
    )


@router.get("/pandals/{id}", response_model=PandalOut)
async def get_pandal(id: str):
    for r in _load():
        if r["id"] == id:
            return r
    raise HTTPException(status_code=404, detail="pandal not found")
