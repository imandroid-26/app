"""Criterion: directions links valid; walking vs straight-line distances not confused.

maddox-square (exact pin) gets a coordinate-based directions URL and both a
straight-line metro distance and a routed walking distance. 22-palli has a
practicalMetro that differs from its nearestMetro (shorter actual walk).
"""


def test_exact_pin_has_straight_line_and_routed_walk_distances(client):
    resp = client.get("/pandals/maddox-square")
    assert resp.status_code == 200, f"unexpected status: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    assert body["metroStraightLineKm"] == 0.9, f"expected 0.9 km straight-line, got {body['metroStraightLineKm']}"
    assert body["distanceFromMetroKm"] == 1.18, f"expected 1.18 km routed walk, got {body['distanceFromMetroKm']}"
    assert body["walkingTimeFromMetroMinutes"] == 16
    # straight-line and routed-walk must be distinct fields, never conflated
    assert body["metroStraightLineKm"] != body["distanceFromMetroKm"]


def test_practical_metro_differs_from_nearest_when_shorter(client):
    resp = client.get("/pandals/22-palli")
    assert resp.status_code == 200, f"unexpected status: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    assert body["nearestMetro"] == "Jatin Das Park"
    assert body["practicalMetro"] == "Netaji Bhavan"
    assert body["practicalMetro"] != body["nearestMetro"], (
        "practicalMetro should surface a shorter routed walk distinct from the straight-line nearest station"
    )
