// Geospatial helpers. All distances computed here are STRAIGHT-LINE (Haversine)
// and must be labelled as such in the UI — never presented as walking distance.
export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: LatLon, b: LatLon): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(meters < 9500 ? 1 : 0)} km`;
}

// Transparent arithmetic estimate (80 m/min ≈ 4.8 km/h — a normal walking pace).
// Always rendered with a "~" and an "estimate" label in the UI.
export function estimateWalkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80));
}
