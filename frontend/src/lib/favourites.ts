import { useSyncExternalStore } from "react";

// Favourites persist in localStorage across refreshes. A tiny external store
// keeps every mounted component (cards, detail page, nav pill) in sync.
const KEY = "pujopath_favourites";

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

let ids: string[] = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function setIds(next: string[]) {
  ids = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode) — favourites stay for this session only
  }
  emit();
}

export interface FavouritesApi {
  ids: string[];
  isFav: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export function useFavourites(): FavouritesApi {
  const snapshot = useSyncExternalStore(subscribe, () => ids, () => ids);
  return {
    ids: snapshot,
    isFav: (id) => snapshot.includes(id),
    toggle: (id) => setIds(snapshot.includes(id) ? snapshot.filter((x) => x !== id) : [...snapshot, id]),
    remove: (id) => setIds(snapshot.filter((x) => x !== id)),
    clear: () => setIds([]),
  };
}
