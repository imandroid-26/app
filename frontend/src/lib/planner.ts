import { useSyncExternalStore } from "react";
import { haversineMeters } from "./geo";
import type { LatLon } from "./geo";
import type { Pandal, PinnedPandal } from "./types";
import { hasPin } from "./types";

// ---------------------------------------------------------------------------
// Current route (planner working state)
// ---------------------------------------------------------------------------
const STOPS_KEY = "pujopath_planner_stops";

function loadStops(): string[] {
  try {
    const raw = localStorage.getItem(STOPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

let stops: string[] = loadStops();
const stopListeners = new Set<() => void>();

function emitStops() {
  try {
    localStorage.setItem(STOPS_KEY, JSON.stringify(stops));
  } catch {
    // session-only fallback
  }
  stopListeners.forEach((l) => l());
}

function setStops(next: string[]) {
  stops = next;
  emitStops();
}

function subscribeStops(l: () => void): () => void {
  stopListeners.add(l);
  return () => stopListeners.delete(l);
}

export function usePlannerStops(): {
  stops: string[];
  addStop: (id: string) => void;
  removeStop: (id: string) => void;
  setStops: (ids: string[]) => void;
  clearStops: () => void;
} {
  const snapshot = useSyncExternalStore(subscribeStops, () => stops, () => stops);
  return {
    stops: snapshot,
    addStop: (id) => {
      if (!snapshot.includes(id)) setStops([...snapshot, id]);
    },
    removeStop: (id) => setStops(snapshot.filter((x) => x !== id)),
    setStops: (next) => setStops(next),
    clearStops: () => setStops([]),
  };
}

// ---------------------------------------------------------------------------
// Saved itineraries
// ---------------------------------------------------------------------------
export interface Itinerary {
  id: string;
  name: string;
  createdAt: string;
  stopIds: string[];
}

const ITIN_KEY = "pujopath_itineraries";

function loadItins(): Itinerary[] {
  try {
    const raw = localStorage.getItem(ITIN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is Itinerary =>
        typeof x === "object" && x !== null && typeof (x as Itinerary).id === "string" && Array.isArray((x as Itinerary).stopIds),
    );
  } catch {
    return [];
  }
}

let itineraries: Itinerary[] = loadItins();
const itinListeners = new Set<() => void>();

function emitItins() {
  try {
    localStorage.setItem(ITIN_KEY, JSON.stringify(itineraries));
  } catch {
    // ignore
  }
  itinListeners.forEach((l) => l());
}

export function useItineraries(): {
  itineraries: Itinerary[];
  save: (name: string, stopIds: string[]) => Itinerary;
  remove: (id: string) => void;
} {
  const snapshot = useSyncExternalStore(subscribeItins, () => itineraries, () => itineraries);
  return {
    itineraries: snapshot,
    save: (name, stopIds) => {
      const itin: Itinerary = {
        id: `itin-${Date.now()}`,
        name: name.trim() || `Route ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        stopIds,
      };
      itineraries = [itin, ...itineraries];
      emitItins();
      return itin;
    },
    remove: (id) => {
      itineraries = itineraries.filter((i) => i.id !== id);
      emitItins();
    },
  };
}

function subscribeItins(l: () => void): () => void {
  itinListeners.add(l);
  return () => itinListeners.delete(l);
}

// ---------------------------------------------------------------------------
// Route optimisation — nearest-neighbour construction + 2-opt improvement over
// straight-line (Haversine) legs. This is a real optimisation method, but the
// result orders by straight-line distance only: actual walking routes cross
// streets and blocks, so the UI labels the order as a sensible suggestion.
// ---------------------------------------------------------------------------
export function optimizeOrder(start: LatLon | null, input: Pandal[]): Pandal[] {
  // Stops without a verified position can't be ordered by distance: keep them,
  // in their current order, after the ordered ones.
  const unpinned = input.filter((p) => !hasPin(p));
  const stopsPandals = input.filter(hasPin);
  if (stopsPandals.length <= 2) return [...stopsPandals, ...unpinned];
  const anchor: LatLon = start ?? {
    lat: stopsPandals[0].lat,
    lon: stopsPandals[0].lon,
  };

  // nearest-neighbour construction
  const remaining: PinnedPandal[] = [...stopsPandals];
  if (start === null) {
    // no explicit start: begin from the first stop, treat it as fixed head
    remaining.splice(0, 1);
  }
  const ordered: PinnedPandal[] = start === null ? [stopsPandals[0]] : [];
  while (remaining.length > 0) {
    const last: LatLon = ordered.length > 0 ? ordered[ordered.length - 1] : anchor;
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMeters(last, remaining[i]);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }

  // 2-opt improvement (stops closed-tour with return to the anchor)
  const leg = (a: LatLon, b: LatLon) => haversineMeters(a, b);
  const tourCost = (t: PinnedPandal[]): number => {
    let c = leg(anchor, t[0]);
    for (let i = 0; i < t.length - 1; i++) c += leg(t[i], t[i + 1]);
    return c;
  };

  let improved = true;
  let best = ordered;
  let bestCost = tourCost(best);
  const guard = best.length * best.length; // bounded passes
  let iterations = 0;
  while (improved && iterations < guard) {
    improved = false;
    iterations++;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const c = tourCost(candidate);
        if (c < bestCost - 1) {
          best = candidate;
          bestCost = c;
          improved = true;
        }
      }
    }
  }
  return [...best, ...unpinned];
}

/** Straight-line length of the leg ARRIVING at each stop (null when either end has no pin). */
export function routeLegs(start: LatLon | null, ordered: Pandal[]): (number | null)[] {
  const legs: (number | null)[] = [];
  let prev: LatLon | null = start;
  for (const p of ordered) {
    legs.push(prev && hasPin(p) ? haversineMeters(prev, p) : null);
    prev = hasPin(p) ? p : null;
  }
  return legs;
}
