"""Criterion: Puja Guide chat (Gemini 3 Flash) is grounded.

POST /api/guide/chat with an empty message -> 422 (validation). A valid
message streams SSE deltas that cite real pandal ids via [[id]] markers,
and those ids must resolve to real /api/pandals/<id> records (grounding).
"""

import uuid
import re

import httpx


def test_empty_message_rejected_422(client):
    resp = client.post(
        "/guide/chat",
        json={"session_id": "tscheck-guide-empty-0001", "message": ""},
    )
    assert resp.status_code == 422, f"expected 422, got {resp.status_code} {resp.text[:300]}"


def test_valid_message_streams_grounded_pandal_citations(client, backend_url):
    session_id = f"tscheck-guide-{uuid.uuid4().hex[:10]}"
    full_text = ""
    with httpx.Client(base_url=f"{backend_url}/api", timeout=40.0) as c:
        with c.stream(
            "POST",
            "/guide/chat",
            json={"session_id": session_id, "message": "Suggest pandals near Salt Lake"},
        ) as resp:
            assert resp.status_code == 200, f"unexpected status: {resp.status_code}"
            for line in resp.iter_lines():
                if line.startswith("data: "):
                    full_text += line[len("data: "):]

    assert full_text, "expected at least one SSE event"
    assert '"type": "delta"' in full_text or '"type":"delta"' in full_text, full_text[:300]

    cited_ids = re.findall(r"\[\[([a-z0-9\-]+)\]\]", full_text)
    assert cited_ids, f"expected at least one [[pandal-id]] citation, got: {full_text[:500]}"

    with httpx.Client(base_url=f"{backend_url}/api", timeout=30.0) as c:
        for pid in cited_ids[:5]:
            r = c.get(f"/pandals/{pid}")
            assert r.status_code == 200, f"cited pandal id {pid!r} does not resolve: {r.status_code} {r.text[:200]}"
