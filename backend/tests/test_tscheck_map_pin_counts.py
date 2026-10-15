"""Criterion: map pins only for records with valid coordinates.

/api/pandals/stats must report exactPins + approximatePins == withMetro-ish
pin count (305) and noPin == 55, matching the 360-record dataset so the /map
page only plots the 305 records that actually have lat/lon.
"""


def test_stats_pin_breakdown_matches_dataset(client):
    resp = client.get("/pandals/stats")
    assert resp.status_code == 200, f"unexpected status: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    assert body["total"] == 360
    assert body["exactPins"] == 279
    assert body["approximatePins"] == 26
    assert body["noPin"] == 55
    assert body["exactPins"] + body["approximatePins"] == 305, "pinned records should total 305"


def test_pandals_with_coordinates_count_matches_305(client):
    resp = client.get("/pandals")
    assert resp.status_code == 200, f"unexpected status: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    with_coords = [p for p in body if p.get("lat") is not None and p.get("lon") is not None]
    without_coords = [p for p in body if p.get("lat") is None]
    assert len(with_coords) == 305, f"expected 305 records with coordinates, got {len(with_coords)}"
    assert len(without_coords) == 55, f"expected 55 records without coordinates, got {len(without_coords)}"
