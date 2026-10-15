import type { Pandal } from "./types";

export type TravelMode = "walking" | "driving" | "transit";

/**
 * Google Maps directions URL.
 * - Verified pin  → destination is the coordinate pair (identifiable on the map).
 * - Approximate pin (neighbourhood anchor) → destination is a name + locality
 *   search so the destination stays identifiable; the UI labels it approximate.
 * `api=1` official URL scheme works on desktop, Android and iOS browsers.
 */
export function dirUrlFor(p: Pandal, mode?: TravelMode): string {
  const params = new URLSearchParams({ api: "1" });
  if (mode) params.set("travelmode", mode);
  if (p.locationAccuracy === "exact" && p.lat !== null && p.lon !== null) {
    params.set("destination", `${p.lat},${p.lon}`);
  } else {
    params.set("destination", `${p.name}, ${p.neighbourhood ?? ""}, Kolkata`.replace(/, ,/, ","));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Destination-search URL (no directions), used when a pin is approximate. */
export function searchUrlFor(p: Pandal): string {
  const q = `${p.name}, ${p.neighbourhood ?? ""}, Kolkata`.replace(/, ,/, ",");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export interface RouteSegment {
  label: string;
  url: string;
  stopIds: string[];
}

/**
 * Multi-stop Google Maps directions. The `api=1` scheme supports at most
 * 9 waypoints per URL, so an itinerary of N stops is split into segments of
 * up to 10 pandals each (origin + 8 waypoints + destination). The hand-off
 * between segments is the first stop of the next link.
 */
export function multiStopLinks(
  origin: { lat: number; lon: number } | null,
  stops: Pandal[],
  mode: TravelMode,
): RouteSegment[] {
  const segments: RouteSegment[] = [];
  const CHUNK = 10;
  for (let i = 0; i < stops.length; i += CHUNK) {
    const chunk = stops.slice(i, i + CHUNK);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    const useOrigin = i === 0 && origin !== null;
    const dest = last;
    const waypoints = useOrigin ? chunk.slice(0, -1) : chunk.slice(1, -1);
    const params = new URLSearchParams({ api: "1" });
    if (useOrigin && origin) params.set("origin", `${origin.lat},${origin.lon}`);
    params.set("destination", destText(dest));
    if (waypoints.length > 0) {
      params.set("waypoints", waypoints.map(destText).join("|"));
    }
    params.set("travelmode", mode);
    const from = i + 1;
    const to = i + chunk.length;
    segments.push({
      label:
        segments.length === 0 && i + chunk.length >= stops.length
          ? "Full route"
          : `Part ${segments.length + 1} · stops ${from}–${to}`,
      url: `https://www.google.com/maps/dir/?${params.toString()}`,
      stopIds: chunk.map((s) => s.id),
    });
  }
  return segments;
}

function destText(p: Pandal): string {
  return p.locationAccuracy === "exact" && p.lat !== null
    ? `${p.lat},${p.lon}`
    : `${p.name}, ${p.neighbourhood ?? ""}, Kolkata`.replace(/, ,/, ",");
}
