import type { Pandal, MetroStation } from "./types";
import { PANDALS } from "@/data/pandals.data";
import { METRO_STATIONS } from "@/data/metro_stations.data";

export { PANDALS, METRO_STATIONS };

export interface ZoneInfo {
  code: string;
  name: string;
  short: string;
  hex: string;
  softBg: string;
  softBorder: string;
  text: string;
}

// Zone colours follow /app/design_guidelines.json (zone_styling_matrix).
export const ZONES: ZoneInfo[] = [
  { code: "I", name: "North & Central Kolkata", short: "North & Central", hex: "#C8281E", softBg: "#FEF2F2", softBorder: "#FECACA", text: "#991B1B" },
  { code: "II", name: "South & South-East Kolkata", short: "South & South-East", hex: "#D97706", softBg: "#FFFBEB", softBorder: "#FDE68A", text: "#92400E" },
  { code: "III", name: "Port Area", short: "Port Area", hex: "#0D9488", softBg: "#F0FDFA", softBorder: "#99F6E4", text: "#115E59" },
  { code: "IV", name: "South Suburban & South-West Kolkata", short: "South Suburban & South-West", hex: "#7C3AED", softBg: "#FAF5FF", softBorder: "#DDD6FE", text: "#6B21A8" },
  { code: "V", name: "Salt Lake, New Town & North-East", short: "Salt Lake & New Town", hex: "#1D4ED8", softBg: "#EFF6FF", softBorder: "#BFDBFE", text: "#1E3A8A" },
  { code: "VI", name: "Howrah", short: "Howrah", hex: "#BE185D", softBg: "#FDF2F8", softBorder: "#FBCFE8", text: "#9D174D" },
];

export const ZONE_BY_CODE: Record<string, ZoneInfo> = Object.fromEntries(
  ZONES.map((z) => [z.code, z]),
);

const BY_ID: Map<string, Pandal> = new Map(PANDALS.map((p) => [p.id, p]));

export function pandalById(id: string): Pandal | undefined {
  return BY_ID.get(id);
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\u0980-\u09FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SearchFields {
  name: string;
  alt: string;
  neighbourhood: string;
  nearStreet: string;
  metro: string;
}

const INDEX: { p: Pandal; f: SearchFields }[] = PANDALS.map((p) => ({
  p,
  f: {
    name: norm(p.name),
    alt: norm([p.nameBn ?? "", ...p.alternateNames].join(" ")),
    neighbourhood: norm(p.neighbourhood ?? ""),
    nearStreet: norm(p.nearStreet ?? ""),
    metro: norm(p.nearestMetro ?? ""),
  },
}));

/** Substring search over name, Bengali name, alternate names, neighbourhood,
 *  near-street reference and nearest metro station. */
export function searchPandals(q: string): Pandal[] {
  const needle = norm(q);
  if (!needle) return [...PANDALS];
  const tokens = needle.split(" ").filter(Boolean);
  return INDEX.filter(({ f }) => {
    const hay = `${f.name} ${f.alt} ${f.neighbourhood} ${f.nearStreet} ${f.metro}`;
    return tokens.every((t) => hay.includes(t));
  }).map(({ p }) => p);
}

export function zoneCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of PANDALS) counts[p.zone] = (counts[p.zone] ?? 0) + 1;
  return counts;
}

export const METRO_NAMES: string[] = [...new Set(PANDALS.map((p) => p.nearestMetro).filter((m): m is string => !!m))].sort();

export const NEIGHBOURHOODS: string[] = [...new Set(PANDALS.map((p) => p.neighbourhood).filter((m): m is string => !!m))].sort();

export const TOTALS = {
  pandals: PANDALS.length,
  zones: new Set(PANDALS.map((p) => p.zone)).size,
  metroStations: METRO_NAMES.length,
  verifiedPins: PANDALS.filter((p) => p.locationAccuracy === "exact").length,
  noPin: PANDALS.filter((p) => p.locationAccuracy === "unknown").length,
};

// Curated "big pujas" for the home page — all verified records from the import.
const FEATURED_IDS = [
  "ekdalia-evergreen",
  "college-square",
  "bagbazar-sarbojanin",
  "santosh-mitra-square",
  "suruchi-sangha",
  "chetla-agrani",
  "maddox-square",
  "sovabazar-rajbari",
];

export function featuredPandals(): Pandal[] {
  return FEATURED_IDS.map((id) => BY_ID.get(id)).filter((p): p is Pandal => !!p);
}
