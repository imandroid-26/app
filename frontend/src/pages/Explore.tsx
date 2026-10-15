import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Filter, List, Map as MapIcon, MapPinOff, RotateCcw, Search, TrainFront } from "lucide-react";
import type { VerificationStatus } from "@/lib/types";
import { METRO_NAMES, PANDALS, ZONES, searchPandals } from "@/lib/pandals";
import { PandalCard } from "@/components/PandalCard";
import { PandalMap } from "@/components/PandalMap";
import { useGeoLocation } from "@/lib/useGeo";
import { haversineMeters } from "@/lib/geo";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<VerificationStatus, string> = {
  verified: "Verified",
  partially_verified: "Partially verified",
  name_only: "Name only",
  needs_review: "Needs review",
};

const SORTS = [
  { value: "name", label: "A–Z" },
  { value: "distance", label: "Distance from me" },
  { value: "zone", label: "Zone" },
  { value: "metro", label: "Metro station" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

function parseCsv(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const geo = useGeoLocation();
  const [mapExpanded, setMapExpanded] = useState(false);

  const q = params.get("q") ?? "";
  const zonesRaw = params.get("zones") ?? "";
  const statusesRaw = params.get("statuses") ?? "";
  const zones = useMemo(() => parseCsv(zonesRaw), [zonesRaw]);
  const statuses = useMemo(() => parseCsv(statusesRaw), [statusesRaw]);
  const metro = params.get("metro") ?? "";
  const only2026 = params.get("p2026") === "1";
  const sort = (params.get("sort") ?? "name") as SortValue;
  const view = params.get("view") === "map" ? "map" : "list";

  // React Router hands functional updaters the render-time params, so rapid
  // successive updates (Reset then typing) can resurrect stale filters. Keep
  // the latest params in a ref that every writer reads and writes synchronously.
  const latest = useRef(new URLSearchParams(params));
  useEffect(() => {
    latest.current = new URLSearchParams(params);
  }, [params]);

  function commit(p: URLSearchParams) {
    latest.current = p;
    setParams(p, { replace: true });
  }

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(latest.current);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    commit(p);
  }

  function toggleCsv(key: string, value: string) {
    const p = new URLSearchParams(latest.current);
    const cur = parseCsv(p.get(key));
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    if (next.length) p.set(key, next.join(","));
    else p.delete(key);
    commit(p);
  }

  const resetAll = () => commit(new URLSearchParams());

  const base = useMemo(() => searchPandals(q), [q]);
  const filtered = useMemo(() => {
    let out = base;
    if (zones.length) out = out.filter((p) => zones.includes(p.zone));
    if (statuses.length) out = out.filter((p) => statuses.includes(p.verificationStatus));
    if (metro) out = out.filter((p) => p.nearestMetro === metro);
    if (only2026) out = out.filter((p) => p.puja2026Status === "confirmed");
    if (sort === "name") out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "zone") out = [...out].sort((a, b) => a.zone.localeCompare(b.zone) || a.name.localeCompare(b.name));
    if (sort === "metro") out = [...out].sort((a, b) => (a.nearestMetro ?? "").localeCompare(b.nearestMetro ?? "") || a.name.localeCompare(b.name));
    if (sort === "distance") {
      if (geo.coords) {
        out = [...out].sort(
          (a, b) => haversineMeters(geo.coords!, { lat: a.lat, lon: a.lon }) - haversineMeters(geo.coords!, { lat: b.lat, lon: b.lon }),
        );
      }
    }
    return out;
  }, [base, zones, statuses, metro, only2026, sort, geo.coords]);

  const hasFilters = q !== "" || zones.length > 0 || statuses.length > 0 || metro !== "" || only2026;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Explore pandals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {PANDALS.length} pandals in the dataset — currently showing{" "}
            <span data-testid="explore-result-count" className="font-semibold text-foreground">
              {filtered.length}
            </span>
            {hasFilters ? " after filters" : ""}.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/70 p-1" role="group" aria-label="View">
          <button
            type="button"
            data-testid="explore-view-list-button"
            aria-pressed={view === "list"}
            onClick={() => update({ view: null })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="size-4" aria-hidden /> List
          </button>
          <button
            type="button"
            data-testid="explore-view-map-button"
            aria-pressed={view === "map"}
            onClick={() => update({ view: "map" })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              view === "map" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MapIcon className="size-4" aria-hidden /> Map
          </button>
        </div>
      </header>

      {/* -------- search + filters -------- */}
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <label htmlFor="explore-search" className="sr-only">
              Search by name, neighbourhood or metro station
            </label>
            <input
              id="explore-search"
              data-testid="pandal-search-input"
              value={q}
              onChange={(e) => update({ q: e.target.value || null })}
              placeholder="Search name, Bengali name, neighbourhood, street or metro station…"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none"
            />
          </div>
          <label htmlFor="explore-sort" className="sr-only">
            Sort
          </label>
          <select
            id="explore-sort"
            data-testid="explore-sort-select"
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value} disabled={s.value === "distance" && !geo.coords}>
                {s.value === "distance" && !geo.coords ? `${s.label} (enable location)` : s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="explore-reset-filters"
            onClick={resetAll}
            disabled={!hasFilters && view === "list"}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-40"
          >
            <RotateCcw className="size-4" aria-hidden /> Reset
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-4 text-muted-foreground" aria-hidden />
          {ZONES.map((z) => {
            const active = zones.includes(z.code);
            return (
              <button
                key={z.code}
                type="button"
                data-testid={`zone-filter-${z.code}`}
                aria-pressed={active}
                onClick={() => toggleCsv("zones", z.code)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-[background-color,border-color] duration-150",
                  active ? "" : "hover:border-foreground/30",
                )}
                style={
                  active
                    ? { backgroundColor: z.hex, borderColor: z.hex, color: "#FFF8F0" }
                    : { backgroundColor: z.softBg, borderColor: z.softBorder, color: z.text }
                }
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: active ? "#FFF8F0" : z.hex }} aria-hidden />
                {z.short}
              </button>
            );
          })}
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          {(Object.keys(STATUS_LABELS) as VerificationStatus[]).map((s) => {
            const active = statuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                data-testid={`verification-filter-${s}`}
                aria-pressed={active}
                onClick={() => toggleCsv("statuses", s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/70 text-muted-foreground hover:text-foreground",
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            );
          })}
          <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              data-testid="explore-p2026-checkbox"
              checked={only2026}
              onChange={(e) => update({ p2026: e.target.checked ? "1" : null })}
              className="size-3.5 accent-[#C8281E]"
            />
            Confirmed for Puja 2026 only
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <TrainFront className="size-3.5" aria-hidden /> Nearest metro:
          </span>
          <select
            aria-label="Filter by metro station"
            data-testid="explore-metro-select"
            value={metro}
            onChange={(e) => update({ metro: e.target.value || null })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:border-ring focus:outline-none"
          >
            <option value="">{`All stations (${METRO_NAMES.length})`}</option>
            {METRO_NAMES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* -------- results -------- */}
      {view === "map" ? (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <PandalMap
              pandals={filtered}
              className={cn("h-[62vh] w-full rounded-xl border border-border/70", mapExpanded && "h-[80vh]")}
              onDetails={(id) => navigate(`/pandal/${id}`)}
              userCoords={geo.coords}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Map shows pins with coordinates ({filtered.filter((p) => p.locationAccuracy === "exact").length} exact,
            {" "}{filtered.filter((p) => p.locationAccuracy === "approximate").length} approximate neighbourhood
            anchors, drawn hollow). Records without verified pins appear in the list view only.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div data-testid="explore-empty-state" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <MapPinOff className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No pandals match these filters.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {only2026
              ? "No pandal has organiser-confirmed 2026 participation yet — the reference directory lists them for the 2026 season without per-pandal confirmation, so this filter is empty for now."
              : "Try a shorter search term, or clear a filter or two."}
          </p>
          <button
            type="button"
            data-testid="explore-empty-reset-button"
            onClick={resetAll}
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform duration-100 active:scale-[0.98]"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <PandalCard key={p.id} pandal={p} userCoords={geo.coords} />
          ))}
        </div>
      )}
    </div>
  );
}
