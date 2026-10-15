from datetime import datetime
from typing import Literal, Optional
import uuid

from pydantic import BaseModel, Field

CrowdLevel = Literal["easy", "busy", "packed"]


class CrowdReportCreate(BaseModel):
    pandal_id: str = Field(min_length=1, max_length=120)
    level: CrowdLevel
    client_id: str = Field(min_length=8, max_length=64)


class CrowdReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pandal_id: str
    level: CrowdLevel
    client_id: str
    created_at: datetime


class CrowdSummary(BaseModel):
    pandal_id: str
    level: CrowdLevel
    reports: int
    easy: int
    busy: int
    packed: int
    latest_at: datetime
    minutes_ago: int


class PujaDay(BaseModel):
    key: str
    label: str
    date: str  # YYYY-MM-DD (Asia/Kolkata)


class PujaToday(BaseModel):
    today: str
    phase: Literal["before", "during", "after"]
    current: Optional[PujaDay] = None
    next: Optional[PujaDay] = None
    days_until_start: int
    seconds_until_start: int
    start_date: str
    end_date: str
