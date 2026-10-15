// TS mirror of the generated dataset (scripts/build_dataset.py). Keep in sync.
export type VerificationStatus = "verified" | "partially_verified" | "name_only" | "needs_review";

export interface Pandal {
  id: string;
  sourceSlug: string | null;
  name: string;
  nameBn: string | null;
  alternateNames: string[];
  neighbourhood: string | null;
  zone: string;
  zoneName: string;
  zoneShort: string;
  nearStreet: string | null;
  address: null;
  lat: number;
  lon: number;
  locationAccuracy: "exact" | "approximate";
  geocodeMethod: string;
  nearestMetro: string | null;
  metroLine: string[];
  metroStationLat: number | null;
  metroStationLon: number | null;
  distanceFromMetroKm: number | null;
  walkingTimeFromMetroMinutes: null;
  googleMapsPlaceUrl: null;
  googleMapsDirectionsUrl: string;
  directionsIsApproximate: boolean;
  verificationStatus: VerificationStatus;
  verifiedFields: string[];
  reviewNotes: string | null;
  sourceUrls: string[];
  lastVerifiedAt: string;
  puja2026Status: "confirmed" | "unconfirmed" | "unknown";
  imageUrl: null;
  theme: null;
}

export interface MetroStation {
  name: string;
  lines: string[];
  lat: number;
  lon: number;
  osmId: string;
}
