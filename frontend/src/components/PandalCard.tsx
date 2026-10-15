import { Link } from "react-router-dom";
import { Heart, Navigation, TrainFront } from "lucide-react";
import type { Pandal } from "@/lib/types";
import { hasPin } from "@/lib/types";
import { ZONE_BY_CODE } from "@/lib/pandals";
import { formatDistance, haversineMeters } from "@/lib/geo";
import { dirUrlFor } from "@/lib/directions";
import { useFavourites } from "@/lib/favourites";
import { VerificationBadge } from "./VerificationBadge";
import { CrowdChip } from "./Crowd";
import { cn } from "@/lib/utils";

interface Props {
  pandal: Pandal;
  userCoords?: { lat: number; lon: number } | null;
}

export function PandalCard({ pandal: p, userCoords }: Props) {
  const fav = useFavourites();
  const isFav = fav.isFav(p.id);
  const zone = ZONE_BY_CODE[p.zone];
  const straight =
    userCoords && hasPin(p) ? haversineMeters(userCoords, p) : null;

  return (
    <article
      data-testid="pandal-card-item"
      className="group relative flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 text-left shadow-[0_1px_2px_rgb(28_22_19/0.04)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-[0_10px_28px_-12px_rgb(28_22_19/0.25)] motion-safe:animate-fade-up"
      style={{ borderLeft: `3px solid ${zone?.hex ?? "#C8281E"}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-bold leading-snug tracking-tight">
            <Link
              to={`/pandal/${p.id}`}
              data-testid="pandal-card-title"
              className="hover:text-primary transition-colors duration-150"
            >
              {p.name}
            </Link>
          </h3>
          {p.nameBn && (
            <p lang="bn" className="text-sm text-muted-foreground/90">
              {p.nameBn}
            </p>
          )}
        </div>
        <button
          type="button"
          data-testid="pandal-card-favourite-toggle"
          aria-label={isFav ? `Remove ${p.name} from favourites` : `Save ${p.name} to favourites`}
          aria-pressed={isFav}
          onClick={() => fav.toggle(p.id)}
          className={cn(
            "shrink-0 rounded-full border p-2 transition-[color,background-color,border-color] duration-150 active:scale-95",
            isFav
              ? "border-primary/40 bg-primary/10 text-primary"
              : "text-muted-foreground hover:border-primary/40 hover:text-primary",
          )}
        >
          {isFav ? (
            <Heart className="size-4 fill-current" aria-hidden />
          ) : (
            <Heart className="size-4" aria-hidden />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium"
          style={{ backgroundColor: zone?.softBg, borderColor: zone?.softBorder, color: zone?.text }}
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: zone?.hex }} aria-hidden />
          {zone?.short ?? p.zoneShort}
        </span>
        {p.neighbourhood && <span className="text-muted-foreground">{p.neighbourhood}</span>}
        <VerificationBadge status={p.verificationStatus} />
        <CrowdChip pandalId={p.id} />
      </div>

      <p data-testid="pandal-card-metro" className="flex items-center gap-2 text-sm text-muted-foreground">
        <TrainFront className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">
          {p.nearestMetro ?? "Nearest metro not yet verified"}
          {p.metroLine.length > 0 && (
            <span className="text-muted-foreground/80"> · {p.metroLine.join(" & ")}</span>
          )}
          {p.distanceFromMetroKm != null ? (
            <span className="text-foreground/80" title="Routed walking distance (OpenStreetMap foot routing)">
              {" "}· {formatDistance(p.distanceFromMetroKm * 1000)} walk
            </span>
          ) : p.metroStraightLineKm != null ? (
            <span className="text-foreground/70" title="Straight-line distance — the street walk is longer">
              {" "}· {formatDistance(p.metroStraightLineKm * 1000)} straight-line
            </span>
          ) : null}
        </span>
      </p>

      {userCoords && (
        <p className="text-xs text-muted-foreground">
          {straight != null ? (
            <>
              <span data-testid="pandal-card-straight-distance" className="font-medium text-foreground/80">
                {formatDistance(straight)}
              </span>{" "}
              straight-line from you
            </>
          ) : (
            <span data-testid="pandal-card-location-unverified">Location not verified — no distance shown</span>
          )}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <a
          href={dirUrlFor(p)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="pandal-card-directions-button"
          title={p.directionsIsApproximate ? "Approximate destination — search by name" : "Directions in Google Maps"}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 text-sm font-medium transition-[background-color,border-color] duration-150 hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]"
        >
          <Navigation className="size-3.5" aria-hidden />
          Directions
        </a>
        <Link
          to={`/pandal/${p.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Details
        </Link>
      </div>
    </article>
  );
}
