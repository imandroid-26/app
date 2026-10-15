import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Heart, Route } from "lucide-react";
import { PandalCard } from "@/components/PandalCard";
import { pandalById, ZONES } from "@/lib/pandals";
import { useFavourites } from "@/lib/favourites";
import { usePlannerStops } from "@/lib/planner";
import { useGeoLocation } from "@/lib/useGeo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function MyPujas() {
  const fav = useFavourites();
  const planner = usePlannerStops();
  const geo = useGeoLocation();

  const saved = useMemo(
    () => fav.ids.map((id) => pandalById(id)).filter((p): p is NonNullable<typeof p> => !!p),
    [fav.ids],
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">My Pujas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your shortlist, saved in this browser ({saved.length} {saved.length === 1 ? "pandal" : "pandals"}).
          </p>
        </div>
        {saved.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="my-pujas-start-route-button"
              onClick={() => {
                planner.setStops(fav.ids);
                toast("Route started from your saved pandals");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform duration-100 hover:bg-primary/90 active:scale-[0.98]"
            >
              <Route className="size-4" aria-hidden /> Plan a route from these
            </button>
            <button
              type="button"
              data-testid="my-pujas-clear-button"
              onClick={() => {
                fav.clear();
                toast("Shortlist cleared");
              }}
              className="rounded-lg border border-border/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        )}
      </header>

      {/* zone filter */}
      {saved.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {ZONES.map((z) => {
            const n = saved.filter((p) => p.zone === z.code).length;
            return (
              <span
                key={z.code}
                data-testid={`my-pujas-zone-count-${z.code}`}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: z.softBg, borderColor: z.softBorder, color: z.text }}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: z.hex }} aria-hidden />
                {z.short} · {n}
              </span>
            );
          })}
        </div>
      )}

      {saved.length === 0 ? (
        <div data-testid="my-pujas-empty-state" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <Heart className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nothing saved yet.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Tap the heart on any pandal to build your shortlist. It stays on this device across visits —
            no account needed.
          </p>
          <Link
            to="/explore"
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Explore pandals
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {saved.map((p) => (
            <PandalCard key={p.id} pandal={p} userCoords={geo.coords} />
          ))}
        </div>
      )}

      <p className={cn("mt-6 text-xs text-muted-foreground", saved.length === 0 && "hidden")}>
        Tip: each card's Directions button opens Google Maps — walking, driving or transit can be chosen on the
        pandal page.
      </p>
    </div>
  );
}
