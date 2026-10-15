"""Live crowd reports: visitors tap easy / busy / packed; reports fade after 90 minutes."""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException

from lib.db import db
from models.crowd import CrowdReport, CrowdReportCreate, CrowdSummary

router = APIRouter()

WINDOW = timedelta(minutes=90)
THROTTLE = timedelta(minutes=10)  # one report per device per pandal per 10 min
LEVEL_SCORE = {"easy": 0, "busy": 1, "packed": 2}

_DATA = Path(__file__).resolve().parents[2] / "frontend/src/data/pandals.json"
_ids_cache: dict = {"mtime": None, "ids": set()}


def pandal_ids() -> set:
    """Valid pandal ids, reloaded whenever the generated dataset changes."""
    mtime = _DATA.stat().st_mtime
    if _ids_cache["mtime"] != mtime:
        _ids_cache["ids"] = {r["id"] for r in json.loads(_DATA.read_text(encoding="utf-8"))}
        _ids_cache["mtime"] = mtime
    return _ids_cache["ids"]


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.post("/crowd/reports", response_model=CrowdReport, status_code=201)
async def create_report(body: CrowdReportCreate):
    if body.pandal_id not in pandal_ids():
        raise HTTPException(status_code=404, detail="pandal not found")
    now = datetime.now(timezone.utc)
    recent = await db.crowd_reports.find_one(
        {"client_id": body.client_id, "pandal_id": body.pandal_id, "created_at": {"$gte": now - THROTTLE}}
    )
    if recent:
        raise HTTPException(status_code=429, detail="You already reported this pandal in the last 10 minutes")
    report = CrowdReport(pandal_id=body.pandal_id, level=body.level, client_id=body.client_id, created_at=now)
    await db.crowd_reports.insert_one({**report.model_dump(), "expires_at": now + timedelta(days=1)})
    return report


def _summarise(pandal_id: str, docs: list, now: datetime) -> CrowdSummary:
    counts = {"easy": 0, "busy": 0, "packed": 0}
    weighted, total_w = 0.0, 0.0
    latest = max(_aware(d["created_at"]) for d in docs)
    for d in docs:
        counts[d["level"]] += 1
        age_min = (now - _aware(d["created_at"])).total_seconds() / 60
        w = max(0.05, 1 - age_min / (WINDOW.total_seconds() / 60))  # newer reports count more
        weighted += LEVEL_SCORE[d["level"]] * w
        total_w += w
    score = weighted / total_w
    level = "easy" if score < 0.67 else "busy" if score < 1.34 else "packed"
    return CrowdSummary(
        pandal_id=pandal_id,
        level=level,
        reports=len(docs),
        latest_at=latest,
        minutes_ago=int((now - latest).total_seconds() // 60),
        **counts,
    )


@router.get("/crowd/summary", response_model=List[CrowdSummary])
async def crowd_summary():
    now = datetime.now(timezone.utc)
    docs = await db.crowd_reports.find(
        {"created_at": {"$gte": now - WINDOW}}, {"_id": 0, "pandal_id": 1, "level": 1, "created_at": 1}
    ).to_list(20000)
    grouped: dict = {}
    for d in docs:
        grouped.setdefault(d["pandal_id"], []).append(d)
    return [_summarise(pid, ds, now) for pid, ds in grouped.items()]


@router.get("/crowd/summary/{pandal_id}", response_model=CrowdSummary)
async def crowd_summary_one(pandal_id: str):
    if pandal_id not in pandal_ids():
        raise HTTPException(status_code=404, detail="pandal not found")
    now = datetime.now(timezone.utc)
    docs = await db.crowd_reports.find(
        {"pandal_id": pandal_id, "created_at": {"$gte": now - WINDOW}}, {"_id": 0}
    ).to_list(5000)
    if not docs:
        raise HTTPException(status_code=404, detail="no recent reports")
    return _summarise(pandal_id, docs, now)
