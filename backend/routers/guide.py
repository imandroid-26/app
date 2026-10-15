"""Puja Guide chat — Gemini 3 Flash (via emergentintegrations + Emergent LLM key),
grounded strictly in the PujoPath dataset.

Each turn: retrieve the most relevant pandal records (keywords, zone/locality,
metro, and distance from the user when they share it), attach live crowd
levels, and give Gemini ONLY those records. The model cites pandals as
[[pandal-id]] tokens, which the frontend turns into links. History is stored in
Mongo (`guide_messages`) and replayed into each new LlmChat instance.
"""
import json
import os
import re
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
from lib.dates import today_iso
from lib.db import db
from models.guide import GuideChatRequest, GuideMessage

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

router = APIRouter()

MODEL_PROVIDER, MODEL_NAME = "gemini", "gemini-3-flash-preview"
_DATA = Path(__file__).resolve().parents[2] / "frontend/src/data/pandals.json"
_cache: dict = {"mtime": None, "rows": []}
CONTEXT_SIZE = 24
HISTORY_TURNS = 6

PUJA_CALENDAR = (
    "Durga Puja 2026: Mahalaya Sat 10 Oct; Shashthi Fri 16 Oct; Saptami on TWO days this year, "
    "Sat 17 and Sun 18 Oct; Ashtami Mon 19 Oct; Navami Tue 20 Oct; Bijoya Dashami Wed 21 Oct."
)

SYSTEM = f"""You are the PujoPath Puja Guide, a warm, concise companion for visiting Kolkata's Durga Puja pandals.

Hard rules:
- Use ONLY the pandal records given in CONTEXT. Never invent pandals, addresses, themes, timings, crowd levels or distances.
- Cite every pandal you mention as [[pandal-id]] right after its name, using the exact id from CONTEXT (e.g. "Maddox Square [[maddox-square]]").
- Distances: say "walk" only for walk_km/walk_min fields (routed on footpaths). straight_km is straight-line — say so. If a value is missing, say it isn't verified.
- If status is name_only/needs_review or pin is approximate/none, warn that the location is not fully verified and to confirm in Google Maps.
- Crowd levels come from visitor reports in the last 90 minutes; mention them only if present ("crowd" field).
- No pandal has organiser-confirmed 2026 participation in our data — never claim one is confirmed.
- If the question can't be answered from CONTEXT, say so briefly and suggest the Explore page or Route Planner.
- Keep answers short: a sentence of framing, then a compact list. No markdown tables. Reply in the user's language (English or Bengali).

{PUJA_CALENDAR}"""

STOP = set("a an the and or of to in on at for near me my i is are what which best good show find tell can you pandal pandals puja pujo durga please some any with from by".split())


def rows() -> list:
    mtime = _DATA.stat().st_mtime
    if _cache["mtime"] != mtime:
        _cache["rows"] = json.loads(_DATA.read_text(encoding="utf-8"))
        _cache["mtime"] = mtime
    return _cache["rows"]


def hv(a, b, c, d):
    a, b, c, d = map(radians, (a, b, c, d))
    h = sin((c - a) / 2) ** 2 + cos(a) * cos(c) * sin((d - b) / 2) ** 2
    return 6371000 * 2 * asin(sqrt(h))


def retrieve(question: str, lat, lon, history_ids: List[str]) -> list:
    q = question.lower()
    toks = [t for t in re.findall(r"[a-z0-9\u0980-\u09ff]+", q) if t not in STOP and len(t) > 1]
    scored = []
    for r in rows():
        hay = " ".join(
            filter(None, [r["name"], r.get("nameBn"), r.get("neighbourhood"), r.get("nearStreet"),
                          r.get("nearestMetro"), r.get("practicalMetro"), r["zoneName"], " ".join(r.get("alternateNames", []))])
        ).lower()
        s = sum(3 if t in r["name"].lower() else 1 for t in toks if t in hay)
        if r["id"] in history_ids:
            s += 2  # keep follow-ups grounded in what was just discussed
        if r["verificationStatus"] == "verified":
            s += 0.3
        d = None
        if lat is not None and r.get("lat") is not None:
            d = hv(lat, lon, r["lat"], r["lon"])
            if any(w in q for w in ("near", "nearby", "close", "walk", "around", "কাছে")):
                s += max(0, 4 - d / 1000)
        scored.append((s, d if d is not None else 9e9, r))
    scored.sort(key=lambda x: (-x[0], x[1]))
    picked = [r for s, _, r in scored[:CONTEXT_SIZE] if s > 0]
    if len(picked) < 8:  # vague question: fall back to well-verified records (nearest first if located)
        extra = sorted((r for r in rows() if r["verificationStatus"] == "verified" and r not in picked),
                       key=lambda r: hv(lat, lon, r["lat"], r["lon"]) if lat is not None else 0)
        picked += extra[: CONTEXT_SIZE - len(picked)]
    return picked


def compact(r: dict, crowd: dict, lat, lon) -> dict:
    out = {
        "id": r["id"], "name": r["name"], "bn": r.get("nameBn"), "locality": r.get("neighbourhood"),
        "near": r.get("nearStreet"), "zone": r["zoneShort"], "status": r["verificationStatus"],
        "pin": r["locationAccuracy"], "metro": r.get("nearestMetro"), "lines": r.get("metroLine"),
        "straight_km": r.get("metroStraightLineKm"), "walk_km": r.get("distanceFromMetroKm"),
        "walk_min": r.get("walkingTimeFromMetroMinutes"),
    }
    if r.get("practicalMetro") and r["practicalMetro"] != r.get("nearestMetro"):
        out["shorter_walk_from"] = f"{r['practicalMetro']} ({r['practicalWalkKm']} km, {r['practicalWalkMinutes']} min)"
    if lat is not None and r.get("lat") is not None:
        out["km_from_user_straight"] = round(hv(lat, lon, r["lat"], r["lon"]) / 1000, 1)
    if r["id"] in crowd:
        out["crowd"] = crowd[r["id"]]
    return {k: v for k, v in out.items() if v not in (None, [], "")}


async def crowd_levels(ids: List[str]) -> dict:
    since = datetime.now(timezone.utc) - timedelta(minutes=90)
    docs = await db.crowd_reports.find({"pandal_id": {"$in": ids}, "created_at": {"$gte": since}},
                                       {"_id": 0, "pandal_id": 1, "level": 1}).to_list(5000)
    by: dict = {}
    for d in docs:
        by.setdefault(d["pandal_id"], []).append(d["level"])
    return {pid: max(set(lv), key=lv.count) + f" ({len(lv)} reports)" for pid, lv in by.items()}


@router.post("/guide/chat")
async def guide_chat(body: GuideChatRequest):
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Puja Guide is not configured")

    hist = await db.guide_messages.find({"session_id": body.session_id}, {"_id": 0}) \
        .sort("created_at", -1).to_list(HISTORY_TURNS * 2)
    hist.reverse()
    hist_ids = [i for m in hist for i in m.get("pandal_ids", [])]

    picked = retrieve(body.message, body.user_lat, body.user_lon, hist_ids)
    crowd = await crowd_levels([r["id"] for r in picked])
    context = [compact(r, crowd, body.user_lat, body.user_lon) for r in picked]
    valid_ids = {r["id"] for r in picked} | set(hist_ids)

    transcript = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in hist)
    located = "The user shared their location (km_from_user_straight is straight-line)." if body.user_lat is not None else "The user's location is unknown."
    prompt = (
        f"TODAY (Kolkata): {today_iso('Asia/Kolkata')}. {located}\n\n"
        f"CONTEXT ({len(context)} pandal records):\n{json.dumps(context, ensure_ascii=False)}\n\n"
        + (f"EARLIER CONVERSATION:\n{transcript}\n\n" if transcript else "")
        + f"QUESTION: {body.message}"
    )

    now = datetime.now(timezone.utc)
    await db.guide_messages.insert_one(
        GuideMessage(session_id=body.session_id, role="user", content=body.message, created_at=now).model_dump()
    )

    chat = LlmChat(api_key=key, session_id=f"guide-{body.session_id}-{int(now.timestamp())}", system_message=SYSTEM) \
        .with_model(MODEL_PROVIDER, MODEL_NAME)

    async def events():
        parts: List[str] = []
        try:
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    parts.append(ev.content)
                    yield f"data: {json.dumps({'type': 'delta', 'text': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception:  # noqa: BLE001 — surface a friendly error to the client
            yield f"data: {json.dumps({'type': 'error', 'message': 'The guide could not answer right now. Please try again.'})}\n\n"
            return
        text = "".join(parts)
        cited = [i for i in dict.fromkeys(re.findall(r"\[\[([a-z0-9-]+)\]\]", text)) if i in valid_ids]
        await db.guide_messages.insert_one(
            GuideMessage(session_id=body.session_id, role="assistant", content=text, pandal_ids=cited,
                         created_at=datetime.now(timezone.utc)).model_dump()
        )
        yield f"data: {json.dumps({'type': 'done', 'pandal_ids': cited})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/guide/sessions/{session_id}/messages", response_model=List[GuideMessage])
async def guide_history(session_id: str):
    return await db.guide_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(200)


@router.delete("/guide/sessions/{session_id}", status_code=204)
async def guide_clear(session_id: str):
    await db.guide_messages.delete_many({"session_id": session_id})
