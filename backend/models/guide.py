from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class GuideChatRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    message: str = Field(min_length=1, max_length=1000)
    user_lat: Optional[float] = Field(default=None, ge=22.0, le=23.2)
    user_lon: Optional[float] = Field(default=None, ge=87.8, le=89.0)


class GuideMessage(BaseModel):
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    pandal_ids: List[str] = []
    created_at: datetime
