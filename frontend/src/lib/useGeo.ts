import { useCallback, useSyncExternalStore } from "react";

// Shared browser-geolocation state as an external store so several components
// (cards, detail page, planner) see the same position and permission outcome.
// The browser is only asked for a position after the user clicks a button that
// says why it is needed; nothing is ever transmitted anywhere.

export interface GeoCoords {
  lat: number;
  lon: number;
  accuracyM: number;
}

export type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unavailable" | "error";

export interface GeoState {
  status: GeoStatus;
  coords: GeoCoords | null;
  message: string | null;
}

let state: GeoState = { status: "idle", coords: null, message: null };
const listeners = new Set<() => void>();

function setState(next: Partial<GeoState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function requestNow() {
  if (state.status === "locating") return;
  if (!("geolocation" in navigator)) {
    setState({ status: "unavailable", message: "This browser does not support location." });
    return;
  }
  setState({ status: "locating", message: null });
  navigator.geolocation.getCurrentPosition(
    (pos) =>
      setState({
        status: "granted",
        coords: {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        },
        message: null,
      }),
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        setState({
          status: "denied",
          message: "Location permission was denied. You can still browse everything — distances just stay hidden.",
        });
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setState({ status: "unavailable", message: "Your location is not available right now." });
      } else {
        setState({ status: "error", message: "Could not get your location. Please try again." });
      }
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

export function useGeoLocation(): GeoState & { request: () => void } {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  const request = useCallback(() => requestNow(), []);
  return { ...snapshot, request };
}
