"""Puja 2026 calendar, anchored server-side to Kolkata time."""
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException

from lib.dates import today_iso
from models.crowd import PujaDay, PujaToday

router = APIRouter()

TZ = "Asia/Kolkata"

# Keep in sync with frontend/src/lib/puja.ts (PUJA_DAYS). Two Saptamis this year.
PUJA_DAYS = [
    PujaDay(key="shashthi", label="Shashthi", date="2026-10-16"),
    PujaDay(key="saptami-1", label="Saptami", date="2026-10-17"),
    PujaDay(key="saptami-2", label="Saptami", date="2026-10-18"),
    PujaDay(key="ashtami", label="Ashtami", date="2026-10-19"),
    PujaDay(key="navami", label="Navami", date="2026-10-20"),
    PujaDay(key="dashami", label="Dashami", date="2026-10-21"),
]


@router.get("/puja/today", response_model=PujaToday)
async def puja_today(on: Optional[str] = None):
    """`on=YYYY-MM-DD` previews another date (used for testing the banner)."""
    try:
        today = date.fromisoformat(on) if on else date.fromisoformat(today_iso(TZ))
    except ValueError:
        raise HTTPException(status_code=422, detail="on must be YYYY-MM-DD")

    start = date.fromisoformat(PUJA_DAYS[0].date)
    end = date.fromisoformat(PUJA_DAYS[-1].date)
    current = next((d for d in PUJA_DAYS if d.date == today.isoformat()), None)
    upcoming = next((d for d in PUJA_DAYS if date.fromisoformat(d.date) > today), None)

    if today < start:
        phase = "before"
    elif today > end:
        phase = "after"
    else:
        phase = "during"

    tz = ZoneInfo(TZ)
    now = datetime.now(tz) if not on else datetime.combine(today, datetime.min.time(), tz)
    start_dt = datetime.combine(start, datetime.min.time(), tz)
    seconds = max(0, int((start_dt - now).total_seconds()))

    return PujaToday(
        today=today.isoformat(),
        phase=phase,
        current=current,
        next=upcoming,
        days_until_start=max(0, (start - today).days),
        seconds_until_start=seconds,
        start_date=start.isoformat(),
        end_date=(end + timedelta(days=0)).isoformat(),
    )
