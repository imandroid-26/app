"""Criterion: Dataset count comes from the real import.

GET /api/pandals/stats must return total=286 with byStatus breakdown matching
the real imported dataset (verified=214, partially_verified=52, name_only=19,
needs_review=1).
"""


def test_pandals_stats_matches_real_import(client):
    resp = client.get("/pandals/stats")
    assert resp.status_code == 200, f"unexpected status: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    assert body["total"] == 286, f"expected total=286, got {body}"
    by_status = body["byStatus"]
    assert by_status["verified"] == 214
    assert by_status["partially_verified"] == 52
    assert by_status["name_only"] == 19
    assert by_status["needs_review"] == 1
