"""Criterion: live crowd reports — create, dedupe, reject unknown pandal.

POST /api/crowd/reports -> 201 for a fresh report, 429 for a repeat report
from the same client within 10 minutes, 404 for an unknown pandal id.
Uses a unique client_id per test run so it never collides with seeded/other
test data and is safe to re-run.
"""

import uuid


def _unique_client_id() -> str:
    return f"tscheck-crowd-{uuid.uuid4().hex[:10]}"


def test_crowd_report_create_then_dedupe_429(client):
    client_id = _unique_client_id()
    payload = {"pandal_id": "maddox-square", "level": "busy", "client_id": client_id}

    resp1 = client.post("/crowd/reports", json=payload)
    assert resp1.status_code == 201, f"unexpected status: {resp1.status_code} {resp1.text[:300]}"
    body1 = resp1.json()
    assert body1["pandal_id"] == "maddox-square"
    assert body1["level"] == "busy"

    resp2 = client.post("/crowd/reports", json=payload)
    assert resp2.status_code == 429, f"expected 429 on repeat report, got {resp2.status_code} {resp2.text[:300]}"


def test_crowd_report_unknown_pandal_404s(client):
    payload = {"pandal_id": "tscheck-no-such-pandal", "level": "easy", "client_id": _unique_client_id()}
    resp = client.post("/crowd/reports", json=payload)
    assert resp.status_code == 404, f"expected 404, got {resp.status_code} {resp.text[:300]}"
