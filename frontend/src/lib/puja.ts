// Puja 2026 calendar + curated day routes. PUJA_DAYS mirrors backend/routers/puja.py.
export interface PujaDay {
  key: string;
  label: string;
  date: string; // YYYY-MM-DD, Kolkata
}

// Mirror of the PujaToday Pydantic model (backend/models/crowd.py).
export interface PujaToday {
  today: string;
  phase: "before" | "during" | "after";
  current: PujaDay | null;
  next: PujaDay | null;
  days_until_start: number;
  seconds_until_start: number;
  start_date: string;
  end_date: string;
}

export const MAHALAYA = { label: "Mahalaya", date: "2026-10-10" };

// Two Saptamis this year (17 & 18 Oct).
export const PUJA_DAYS: PujaDay[] = [
  { key: "shashthi", label: "Shashthi", date: "2026-10-16" },
  { key: "saptami-1", label: "Saptami", date: "2026-10-17" },
  { key: "saptami-2", label: "Saptami", date: "2026-10-18" },
  { key: "ashtami", label: "Ashtami", date: "2026-10-19" },
  { key: "navami", label: "Navami", date: "2026-10-20" },
  { key: "dashami", label: "Dashami", date: "2026-10-21" },
];

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00+05:30`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/** "Saptami (day 1)" style label that disambiguates the double Saptami. */
export function dayLabel(d: PujaDay): string {
  if (d.key === "saptami-1") return "Saptami · day 1";
  if (d.key === "saptami-2") return "Saptami · day 2";
  return d.label;
}

export interface DayRoute {
  dayKey: string;
  title: string;
  blurb: string;
  stopIds: string[];
}

// Curated one-day suggestions, each kept within one walkable belt of the city.
export const DAY_ROUTES: DayRoute[] = [
  {
    dayKey: "shashthi",
    title: "Old North & Kumartuli",
    blurb: "Start where the idols are made — riverside heritage pujas, quieter on Shashthi.",
    stopIds: ["bagbazar-sarbojanin", "kumartuli-sarbojanin", "ahiritola", "sovabazar-rajbari"],
  },
  {
    dayKey: "saptami-1",
    title: "Central Squares",
    blurb: "College Square to Santosh Mitra Square — the big central themes, close together.",
    stopIds: ["college-square", "md-ali-park", "santosh-mitra-square", "chorebagan-sarbojanin", "chaltabagan-sarbojanin"],
  },
  {
    dayKey: "saptami-2",
    title: "Tala & Shyambazar",
    blurb: "North Kolkata's crowd-pullers along the Shyambazar–Hatibagan stretch.",
    stopIds: ["tala-prattoy", "tala-barowari", "shyam-square", "hatibagan-sarbojanin", "nalin-sarkar-street-durgotsav"],
  },
  {
    dayKey: "ashtami",
    title: "Gariahat & Ballygunge",
    blurb: "After anjali — Ekdalia, Singhi Park and Maddox Square, all in walking range.",
    stopIds: ["ekdalia-evergreen", "singhi-park-sarbojanin", "maddox-square", "tridhara-sammilani", "hindusthan-club", "deshapriya-park", "bakul-bagan-sarbojanin"],
  },
  {
    dayKey: "navami",
    title: "Kalighat, Chetla & the Lakes",
    blurb: "South Kolkata's theme heavyweights — expect the longest Navami queues.",
    stopIds: ["badamtala-ashar-sangha", "66-pally-durga-pujo", "kalighat-milan-sangha", "chetla-agrani", "alipore-sarbojanin", "suruchi-sangha", "samaj-sebi-sangha", "jodhpur-park"],
  },
  {
    dayKey: "dashami",
    title: "Behala & Barisha",
    blurb: "One last round on the Purple Line side before Bijoya.",
    stopIds: ["behala-club", "behala-natun-dal", "behala-friends", "barisha-club", "barisha-sarbojanin", "sahapur-sangha"],
  },
];
