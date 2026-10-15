"""Criterion: honest detail data for every pandal, incl. no-pin records.

GET /api/pandals/<id> must return correct fields for an exact-pin record
(maddox-square), a no-coordinate name-only record (bc-block-durga-puja-new-town),
and 404 for an unknown id.
"""


def test_exact_pin_pandal_has_coordinates(client):
    resp = client.get("/pandals/maddox-square")
    assert resp.status_code == 200, f"unexpected status: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    assert body["locationAccuracy"] == "exact"
    assert body["lat"] == 22.526512 and body["lon"] == 88.354853
    url = body["googleMapsDirectionsUrl"]
    assert url.startswith("https://www.google.com/maps/dir/?api=1&destination="), url
    assert "22.526512" in url and "88.354853" in url, url


def test_no_pin_pandal_is_honest_about_missing_location(client):
    resp = client.get("/pandals/bc-block-durga-puja-new-town")
    assert resp.status_code == 200, f"unexpected status: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    assert body["lat"] is None and body["lon"] is None
    assert body["locationAccuracy"] == "unknown"
    assert body["nearestMetro"] is None
    url = body["googleMapsDirectionsUrl"]
    assert "maps/search/?api=1&query=" in url, url
    assert "22." not in url and "88." not in url, f"no-pin pandal should not expose coordinates: {url}"
    assert "BC" in url or "New" in url, f"destination should be derived from name/neighbourhood: {url}"


def test_unknown_pandal_id_404s(client):
    resp = client.get("/pandals/tscheck-does-not-exist-xyz")
    assert resp.status_code == 404, f"expected 404, got {resp.status_code} {resp.text[:300]}"
