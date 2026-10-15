"""Criterion: Directions URLs for every pandal type.

Exact-location pandals (locationAccuracy == "exact") must carry a
coordinate-based Google Maps directions URL. Approximate pandals
(locationAccuracy == "approximate") must carry a name/neighbourhood search
URL instead of raw coordinates.
"""


def test_exact_pin_uses_coordinate_destination(client):
    resp = client.get("/pandals/ekdalia-evergreen")
    assert resp.status_code == 200, f"unexpected status: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    assert body["locationAccuracy"] == "exact"
    url = body["googleMapsDirectionsUrl"]
    assert url.startswith("https://www.google.com/maps/dir/?api=1&destination="), url
    assert "22.521283" in url and "88.366234" in url, url


def test_approximate_pin_uses_name_destination(client):
    resp = client.get("/pandals/20-pally")
    assert resp.status_code == 200, f"unexpected status: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    assert body["locationAccuracy"] == "approximate"
    url = body["googleMapsDirectionsUrl"]
    assert "maps/search/?api=1&query=" in url, url
    assert "22.6" not in url, f"approximate pin should not expose raw coordinates: {url}"
