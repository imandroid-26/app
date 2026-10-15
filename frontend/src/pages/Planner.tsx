import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  ExternalLink,
  LocateFixed,
  Save,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { PANDALS, pandalById } from "@/lib/pandals";
import type { Pandal } from "@/lib/types";
import { DAY_ROUTES, PUJA_DAYS, dayLabel, shortDate } from "@/lib/puja";
import { usePlannerStops, useItineraries, optimizeOrder, routeLegs } from "@/lib/planner";
import { multiStopLinks } from "@/lib/directions";
import type { TravelMode } from "@/lib/directions";
import { useGeoLocation } from "@/lib/useGeo";
import { formatDistance } from "@/lib/geo";
import { PandalMap } from "@/components/PandalMap";
import { cn } from "@/lib/utils";

export default function Planner() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const planner = usePlannerStops();
  const itins = useItineraries();
  const geo = useGeoLocation();

  const [itinName, setItinName] = useState("");
  const [mode, setMode] = useState<TravelMode>("driving");
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [suggest, setSuggest] = useState("");

  // absorb a shared link ?stops=a,b,c or a banner link ?day=<key> once
  useEffect(() => {
    const dayKey = params.get("day");
    if (dayKey) {
      loadDay(dayKey);
      return;
    }
    const shared = params.get("stops");
    if (!shared) return;
    const ids = shared.split(",").filter((x) => pandalById(x));
    if (ids.length === 0) return;
    planner.setStops(ids);
    toast(`Loaded shared route with ${ids.length} stops`, { description: "Edit it below or open the links." });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per shared param
  }, [params]);

  const [activeDay, setActiveDay] = useState<string | null>(null);

  function loadDay(dayKey: string) {
    const route = DAY_ROUTES.find((r) => r.dayKey === dayKey);
    const day = PUJA_DAYS.find((d) => d.key === dayKey);
    if (!route || !day) return;
    const stopsP = route.stopIds.map((x) => pandalById(x)).filter((p): p is Pandal => !!p);
    planner.setStops(optimizeOrder(null, stopsP).map((p) => p.id));
    setActiveDay(dayKey);
    toast(`${dayLabel(day)} route loaded`, { description: `${route.title} · ${stopsP.length} stops, ordered for walking.` });
  }

  const ordered: Pandal[] = useMemo(
    () => planner.stops.map((x) => pandalById(x)).filter((p): p is Pandal => !!p),
    [planner.stops],
  );

  const start: { lat: number; lon: number } | null = useMemo(
    () => (useMyLocation && geo.coords ? { lat: geo.coords.lat, lon: geo.coords.lon } : null),
    [useMyLocation, geo.coords],
  );

  const legs = useMemo(() => routeLegs(start, ordered), [start, ordered]);
  const total = legs.reduce<number>((a, b) => a + (b ?? 0), 0);
  const segments = useMemo(() => multiStopLinks(start, ordered, mode), [start, ordered, mode]);
  const approxStops = ordered.filter((p) => p.locationAccuracy !== "exact");

  const suggestions = useMemo(() => {
    const q = suggest.trim().toLowerCase();
    if (!q) return [];
    return PANDALS.filter(
      (p) =>
        !planner.stops.includes(p.id) &&
        (p.name.toLowerCase().includes(q) ||
          (p.nameBn ?? "").includes(q) ||
          (p.neighbourhood ?? "").toLowerCase().includes(q) ||
          (p.nearestMetro ?? "").toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [suggest, planner.stops]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Route planner</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pick a few pandals and put them in a sensible order. Ordering uses straight-line distances
          (nearest-neighbour + 2-opt) — real streets will add distance, so treat it as a suggestion and let
          Google Maps route each leg.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ---------------- left: stops + controls ---------------- */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="rounded-xl border border-gold/40 bg-card p-4" data-testid="planner-day-picker">
            <h2 className="mb-1 font-heading text-lg font-bold">Pick a puja day</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              A ready route for each day — two Saptamis this year. Loading one replaces your current stops.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PUJA_DAYS.map((d) => {
                const r = DAY_ROUTES.find((x) => x.dayKey === d.key);
                const active = activeDay === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    data-testid={`planner-day-${d.key}`}
                    aria-pressed={active}
                    onClick={() => loadDay(d.key)}
                    className={cn(
                      "flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]",
                      active ? "border-primary bg-primary/10" : "border-border/70 hover:border-gold/60",
                    )}
                  >
                    <span className="text-sm font-semibold">{dayLabel(d)}</span>
                    <span className="text-xs text-muted-foreground">{shortDate(d.date)}</span>
                    {r && <span className="mt-1 text-xs text-gold-dark">{r.title}</span>}
                  </button>
                );
              })}
            </div>
            {activeDay && (
              <p data-testid="planner-day-blurb" className="mt-3 text-xs text-muted-foreground">
                {DAY_ROUTES.find((x) => x.dayKey === activeDay)?.blurb} Curated suggestion — check crowd reports before you go.
              </p>
            )}
          </section>
          <section className="rounded-xl border border-border/70 bg-card p-4" data-testid="planner-stops-panel">
            <h2 className="mb-3 font-heading text-lg font-bold">Stops ({ordered.length})</h2>

            <div className="relative mb-4">
              <label htmlFor="planner-add-stop" className="sr-only">
                Add a pandal
              </label>
              <input
                id="planner-add-stop"
                data-testid="planner-add-stop-input"
                value={suggest}
                onChange={(e) => setSuggest(e.target.value)}
                placeholder="Add a stop — search pandals…"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none"
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg" data-testid="planner-suggestions-list">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        data-testid={`planner-suggestion-${s.id}`}
                        onClick={() => {
                          planner.addStop(s.id);
                          setSuggest("");
                          toast(`Added ${s.name}`);
                        }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/60"
                      >
                        <span>{s.name}</span>
                        <span className="text-xs text-muted-foreground">{s.neighbourhood}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {ordered.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No stops yet. Search above, or tap “Add to route” on any pandal.
              </p>
            ) : (
              <ol className="flex flex-col gap-2" data-testid="planner-stops-list">
                {ordered.map((p, i) =>
                  p ? (
                    <li key={p.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 p-2 text-sm">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-xs font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Link to={`/pandal/${p.id}`} className="block truncate font-medium hover:text-primary">
                          {p.name}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.neighbourhood} · {p.nearestMetro}
                        </span>
                      </span>
                      {legs[i] != null && (
                        <span className="shrink-0 text-xs text-muted-foreground" title="Straight-line from the previous point">
                          {formatDistance(legs[i] as number)}
                        </span>
                      )}
                      {p.locationAccuracy === "unknown" && (
                        <span className="shrink-0 text-xs text-amber-700 dark:text-amber-300" title="No verified position — not ordered by distance">
                          no pin
                        </span>
                      )}
                      <span className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          aria-label={`Move ${p.name} up`}
                          data-testid={`planner-move-up-${i}`}
                          disabled={i === 0}
                          onClick={() => {
                            const next = [...planner.stops];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            planner.setStops(next);
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowUp className="size-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${p.name} down`}
                          data-testid={`planner-move-down-${i}`}
                          disabled={i === ordered.length - 1}
                          onClick={() => {
                            const next = [...planner.stops];
                            [next[i + 1], next[i]] = [next[i], next[i + 1]];
                            planner.setStops(next);
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowDown className="size-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${p.name} from route`}
                          data-testid={`planner-remove-stop-${i}`}
                          onClick={() => planner.removeStop(p.id)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    </li>
                  ) : null,
                )}
              </ol>
            )}

            {ordered.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="route-planner-optimize-button"
                  onClick={() => {
                    planner.setStops(optimizeOrder(start, ordered).map((p) => p.id));
                    toast("Order optimised", {
                      description: "Nearest-neighbour + 2-opt over straight-line distances.",
                    });
                  }}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-transform duration-100 active:scale-[0.98]"
                >
                  Optimise the order
                </button>
                <button
                  type="button"
                  data-testid="planner-clear-stops-button"
                  onClick={() => planner.clearStops()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden /> Remove all
                </button>
                <span data-testid="planner-total-distance" className="ml-auto text-xs text-muted-foreground">
                  {formatDistance(total)} total <span title="Sum of straight-line legs — real walking routes are longer">Σ straight-line</span>
                </span>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-4" data-testid="planner-start-panel">
            <h2 className="mb-3 font-heading text-lg font-bold">Starting point</h2>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="planner-use-my-location-checkbox"
                checked={useMyLocation}
                onChange={(e) => {
                  setUseMyLocation(e.target.checked);
                  if (e.target.checked && geo.status === "idle") geo.request();
                }}
                className="mt-0.5 size-4 accent-[#C8281E]"
              />
              <span>
                Start from my current location
                <span className="block text-xs text-muted-foreground">
                  {geo.coords
                    ? "Using your location in this browser only."
                    : "Your browser will ask for permission; the location is used only to build the link."}
                </span>
              </span>
            </label>
            {useMyLocation && geo.message && (
              <p className="mt-2 text-xs text-destructive" role="alert">
                {geo.message}
              </p>
            )}
            {useMyLocation && !geo.coords && geo.status === "idle" && (
              <button
                type="button"
                onClick={geo.request}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium"
              >
                <LocateFixed className="size-4" aria-hidden /> Get my location
              </button>
            )}
            {!useMyLocation && ordered.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                No origin set — Google Maps will route from wherever each user is when they open the link,
                starting at stop 1 ({ordered[0]?.name}).
              </p>
            )}
          </section>

          {ordered.length > 0 && (
            <section className="rounded-xl border border-border/70 bg-card p-4" data-testid="planner-gmaps-panel">
              <h2 className="mb-3 font-heading text-lg font-bold">Open in Google Maps</h2>
              <div className="mb-3 flex items-center gap-2 text-sm">
                <label htmlFor="planner-mode">Travel mode</label>
                <select
                  id="planner-mode"
                  data-testid="planner-travel-mode-select"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as TravelMode)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:border-ring focus:outline-none"
                >
                  <option value="walking">Walking</option>
                  <option value="driving">Driving</option>
                  <option value="transit">Public transport</option>
                </select>
              </div>
              {approxStops.length > 0 && (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" data-testid="planner-approximate-warning">
                  <CircleAlert className="mr-1 inline size-3.5" aria-hidden />
                  {approxStops.length} stop{approxStops.length > 1 ? "s" : ""} (
                  {approxStops.map((p) => p.name).join(", ")}) {approxStops.length > 1 ? "have" : "has"} an
                  unverified pin — Google Maps will search by name instead of dropping a possibly-wrong
                  coordinate. Confirm the location in the app.
                </p>
              )}
              <ul className="flex flex-col gap-2" data-testid="planner-gmaps-links">
                {segments.map((seg) => (
                  <li key={seg.url}>
                    <a
                      href={seg.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={segments.length === 1 ? "route-planner-share-google-maps" : undefined}
                      className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:border-primary/50"
                    >
                      <ExternalLink className="size-4 text-primary" aria-hidden />
                      {seg.label} · {seg.stopIds.length} stops
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Google Maps supports at most 9 waypoints per link, so long itineraries are split into parts —
                each part ends where the next begins.
              </p>
            </section>
          )}

          <section className="rounded-xl border border-border/70 bg-card p-4" data-testid="planner-save-panel">
            <h2 className="mb-3 font-heading text-lg font-bold">Save & share</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="planner-itin-name" className="sr-only">
                Itinerary name
              </label>
              <input
                id="planner-itin-name"
                data-testid="planner-itinerary-name-input"
                value={itinName}
                onChange={(e) => setItinName(e.target.value)}
                placeholder="e.g. North Kolkata evening"
                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none"
              />
              <button
                type="button"
                data-testid="planner-save-itinerary-button"
                disabled={ordered.length === 0}
                onClick={() => {
                  itins.save(itinName, planner.stops);
                  setItinName("");
                  toast("Itinerary saved", { description: "It stays in this browser." });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium disabled:opacity-40"
              >
                <Save className="size-4" aria-hidden /> Save
              </button>
              <button
                type="button"
                data-testid="planner-share-link-button"
                disabled={ordered.length === 0}
                onClick={() => {
                  const url = `${location.origin}/planner?stops=${planner.stops.join(",")}`;
                  navigator.clipboard
                    .writeText(url)
                    .then(() => toast("Share link copied", { description: url }))
                    .catch(() => toast("Could not copy — the link is: " + url));
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium disabled:opacity-40"
              >
                <Share2 className="size-4" aria-hidden /> Copy share link
              </button>
            </div>

            {itins.itineraries.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2" data-testid="planner-saved-itineraries">
                {itins.itineraries.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{it.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {it.stopIds.length} stops · saved {new Date(it.createdAt).toLocaleString()}
                      </span>
                    </span>
                    <button
                      type="button"
                      data-testid={`planner-load-itinerary-${it.id}`}
                      onClick={() => {
                        planner.setStops(it.stopIds);
                        toast(`Loaded “${it.name}”`);
                      }}
                      className="rounded-md border border-border/70 px-2 py-1 text-xs font-medium hover:border-primary/50"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${it.name}`}
                      data-testid={`planner-delete-itinerary-${it.id}`}
                      onClick={() => itins.remove(it.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---------------- right: map ---------------- */}
        <div className="lg:col-span-3">
          <PandalMap
            pandals={ordered}
            numbered
            userCoords={start && geo.coords ? geo.coords : null}
            className="h-[50vh] w-full rounded-xl border border-border/70 lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]"
            onDetails={(id) => navigate(`/pandal/${id}`)}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            The line between pins is a straight, indicative connector — not a walking route. Open the Google
            Maps links for real turn-by-turn directions.
          </p>
        </div>
      </div>
    </div>
  );
}
