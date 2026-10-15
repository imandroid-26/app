// TS mirror of the generated dataset (scripts/build_dataset.py). Keep in sync.
export type VerificationStatus = "verified" | "partially_verified" | "name_only" | "needs_review";

export interface Pandal {
  id: string;
  sourceSlug: string | null;
  origin: "odbl_export" | "reference_page_osm_geocoded";
  name: string;
  nameBn: string | null;
  alternateNames: string[];
  neighbourhood: string | null;
  zone: string;
  zoneName: string;
  zoneShort: string;
  nearStreet: string | null;
  address: string | null;
  /** null when no position could be verified — never a placeholder */
  lat: number | null;
  lon: number | null;
  /** exact = verified pin · approximate = landmark/neighbourhood anchor · unknown = no pin */
  locationAccuracy: "exact" | "approximate" | "unknown";
  geocodeMethod: string;
  nearestMetro: string | null;
  directoryListedMetro: string | null;
  metroLine: string[];
  metroStationLat: number | null;
  metroStationLon: number | null;
  /** straight-line km from the pin to nearestMetro */
  metroStraightLineKm: number | null;
  /** ROUTED walking distance/time to nearestMetro (OSRM foot); null if not routed */
  distanceFromMetroKm: number | null;
  walkingTimeFromMetroMinutes: number | null;
  /** station with the shortest routed walk among the 3 nearest */
  practicalMetro: string | null;
  practicalMetroLine: string[];
  practicalWalkKm: number | null;
  practicalWalkMinutes: number | null;
  walkingRouteSource: string | null;
  googleMapsPlaceUrl: string | null;
  googleMapsDirectionsUrl: string;
  directionsIsApproximate: boolean;
  verificationStatus: VerificationStatus;
  verifiedFields: string[];
  reviewNotes: string | null;
  sourceUrls: string[];
  lastVerifiedAt: string;
  puja2026Status: "confirmed" | "unconfirmed" | "unknown";
  imageUrl: string | null;
  theme: string | null;
}

/** A pandal that has a map position (exact or approximate). */
export type PinnedPandal = Pandal & { lat: number; lon: number };

export function hasPin(p: Pandal): p is PinnedPandal {
  return p.lat !== null && p.lon !== null;
}

export interface MetroStation {
  name: string;
  lines: string[];
  lat: number;
  lon: number;
  osmId: string;
}
