"""Criterion: Salt Lake / New Town zone filter (Phase 8).

GET /api/pandals?zone=V must return exactly the 34 Zone V (Salt Lake, New
Town & North-East) pandals, and /api/pandals/stats must report the same
count under byZone.V.
"""


def test_zone_v_filter_returns_34(client):
    resp = client.get("/pandals", params={"zone": "V"})
    assert resp.status_code == 200, f"unexpected status: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    assert isinstance(body, list), f"expected list, got {type(body)}"
    assert len(body) == 34, f"expected 34 Zone V pandals, got {len(body)}"
    assert all(p["zone"] == "V" for p in body), "non-Zone-V record returned by zone=V filter"


def test_stats_byzone_matches_filter_count(client):
    resp = client.get("/pandals/stats")
    assert resp.status_code == 200, f"unexpected status: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    assert body["byZone"]["V"] == 34, f"expected byZone.V == 34, got {body['byZone']}"
    assert body["total"] == 360, f"expected total == 360, got {body['total']}"
