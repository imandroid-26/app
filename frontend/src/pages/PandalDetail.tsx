import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Car,
  CircleHelp,
  ExternalLink,
  Footprints,
  Heart,
  LocateFixed,
  MapPin,
  MapPinOff,
  Plus,
  Route,
  ShieldCheck,
  TrainFront,
} from "lucide-react";
import { pandalById, PANDALS, ZONE_BY_CODE } from "@/lib/pandals";
import { dirUrlFor, searchUrlFor } from "@/lib/directions";
import type { TravelMode } from "@/lib/directions";
import { useFavourites } from "@/lib/favourites";
import { usePlannerStops } from "@/lib/planner";
import { useGeoLocation } from "@/lib/useGeo";
import { estimateWalkMinutes, formatDistance, haversineMeters } from "@/lib/geo";
import { PandalMap } from "@/components/PandalMap";
import { PandalCard } from "@/components/PandalCard";
import { VerificationBadge } from "@/components/VerificationBadge";

const MODES: { mode: TravelMode; label: string; icon: typeof Footprints }[] = [
  { mode: "walking", label: "Walking directions", icon: Footprints },
  { mode: "driving", label: "Driving directions", icon: Car },
  { mode: "transit", label: "Public transport", icon: TrainFront },
];

function NotVerified({ what }: { what: string }) {
  return <span className="text-sm italic text-muted-foreground/70">{what} — not yet verified</span>;
}

export default function PandalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const geo = useGeoLocation();
  const fav = useFavourites();
  const planner = usePlannerStops();

  const p = id ? pandalById(id) : undefined;
  const mapPandals = useMemo(() => (p ? [p] : []), [p]);

  const nearby = useMemo(() => {
    if (!p) return [];
    return PANDALS.filter((x) => x.id !== p.id)
      .map((x) => ({ x, d: haversineMeters({ lat: p.lat, lon: p.lon }, x) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
      .map(({ x }) => x);
  }, [p]);

  if (!p) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-24 text-center">
        <CircleHelp className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="font-heading text-2xl font-bold">Pandal not found</h1>
        <p className="text-sm text-muted-foreground">
          This record is not in the imported dataset. It may have been a duplicate removed during the import.
        </p>
        <Link to="/explore" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Explore all pandals
        </Link>
      </div>
    );
  }

  const isFav = fav.isFav(p.id);
  const inRoute = planner.stops.includes(p.id);
  const zone = ZONE_BY_CODE[p.zone];
  const straightFromUser =
    geo.coords ? haversineMeters(geo.coords, { lat: p.lat, lon: p.lon }) : null;
  const approx = p.locationAccuracy === "approximate";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        data-testid="pandal-detail-back-button"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back
      </button>

      {/* header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium"
              style={{ backgroundColor: zone?.softBg, borderColor: zone?.softBorder, color: zone?.text }}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: zone?.hex }} aria-hidden />
              {zone?.name}
            </span>
            <VerificationBadge status={p.verificationStatus} />
          </div>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl" data-testid="pandal-detail-title">
            {p.name}
          </h1>
          {p.nameBn && (
            <p lang="bn" className="mt-1 text-lg text-muted-foreground">
              {p.nameBn}
            </p>
          )}
          {p.alternateNames.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">Also known as: {p.alternateNames.join(" · ")}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {MODES.map(({ mode, label, icon: Icon }) => (
            <a
              key={mode}
              href={dirUrlFor(p, mode)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`pandal-detail-directions-button-${mode}`}
              title={approx ? "Approximate destination — searched by name" : `Open ${label.toLowerCase()} in Google Maps`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-transform duration-100 hover:bg-primary/90 active:scale-[0.98]"
            >
              <Icon className="size-4" aria-hidden />
              {mode === "walking" ? "Directions" : mode === "driving" ? "Drive" : "Transit"}
            </a>
          ))}
          <button
            type="button"
            data-testid="pandal-detail-save-button"
            aria-pressed={isFav}
            aria-label={isFav ? "Remove from favourites" : "Save to favourites"}
            onClick={() => {
              fav.toggle(p.id);
              toast(isFav ? "Removed from My Pujas" : `Saved ${p.name} to My Pujas`, {
                description: isFav ? undefined : "Find it under My Pujas.",
              });
            }}
            className={
              isFav
                ? "inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
                : "inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:border-primary/50"
            }
          >
            <Heart className={isFav ? "size-4 fill-current" : "size-4"} aria-hidden />
            {isFav ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            data-testid="pandal-detail-add-to-route-button"
            onClick={() => {
              if (inRoute) {
                planner.removeStop(p.id);
                toast("Removed from route");
              } else {
                planner.addStop(p.id);
                toast(`Added to route`, { description: `${planner.stops.length + 1} stop(s) planned — open the Route Planner to order them.` });
              }
            }}
            className={
              inRoute
                ? "inline-flex items-center gap-1.5 rounded-lg border border-gold/60 bg-gold/10 px-3 py-2 text-sm font-semibold text-gold-dark"
                : "inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:border-gold/60"
            }
          >
            {inRoute ? <Route className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {inRoute ? "In route" : "Add to route"}
          </button>
        </div>
      </header>

      {/* body */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="rounded-xl border border-border/70 bg-card p-5" data-testid="pandal-detail-location-panel">
            <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold">
              <MapPin className="size-4 text-primary" aria-hidden /> Location
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Neighbourhood</dt>
              <dd>{p.neighbourhood ?? <NotVerified what="Neighbourhood" />}</dd>
              <dt className="text-muted-foreground">Near</dt>
              <dd>{p.nearStreet ?? <NotVerified what="Street reference" />}</dd>
              <dt className="text-muted-foreground">Street address</dt>
              <dd>
                <NotVerified what="A verified street address" />
              </dd>
              <dt className="text-muted-foreground">Coordinates</dt>
              <dd className="font-mono text-xs">
                {approx ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPinOff className="size-3.5" aria-hidden /> neighbourhood anchor only ({p.lat}, {p.lon})
                  </span>
                ) : (
                  <>
                    {p.lat}, {p.lon}
                    <span className="ml-1 text-muted-foreground">({p.geocodeMethod})</span>
                  </>
                )}
              </dd>
            </dl>
            {approx && (
              <p className="mt-3 rounded-lg bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
                This pin was placed at the centre of the neighbourhood, not verified at the exact site. The
                Directions button searches Google Maps by name instead of dropping a possibly-wrong pin.
              </p>
            )}
            {p.reviewNotes && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" data-testid="pandal-detail-review-note">
                {p.reviewNotes}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-5" data-testid="pandal-detail-metro-panel">
            <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold">
              <TrainFront className="size-4 text-primary" aria-hidden /> Nearest metro
            </h2>
            {p.nearestMetro && p.metroStationLat != null ? (
              <div className="flex flex-col gap-2 text-sm">
                <p className="text-base font-semibold">{p.nearestMetro}</p>
                {p.metroLine.length > 0 && (
                  <p className="flex flex-wrap gap-1.5">
                    {p.metroLine.map((l) => (
                      <span key={l} className="rounded-full border border-border/70 bg-secondary/60 px-2 py-0.5 text-xs font-medium">
                        {l}
                      </span>
                    ))}
                  </p>
                )}
                {p.distanceFromMetroKm != null ? (
                  <p className="text-muted-foreground">
                    {formatDistance(p.distanceFromMetroKm * 1000)} as mapped by the reference directory ·{" "}
                    <span title="Estimated at a normal 80 m/min walking pace — not a routed time">
                      ≈ {estimateWalkMinutes(p.distanceFromMetroKm * 1000)} min walk (estimate)
                    </span>
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Walking distance not verified — the mapped figure for this record looked unreliable, so we
                    don't show one.
                  </p>
                )}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.metroStationLat},${p.metroStationLon}&travelmode=transit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Get to the station <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>
            ) : (
              <NotVerified what="The nearest metro station" />
            )}
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-5" data-testid="pandal-detail-your-location-panel">
            <h2 className="mb-2 flex items-center gap-2 font-heading text-lg font-bold">
              <LocateFixed className="size-4 text-primary" aria-hidden /> Distance from you
            </h2>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              Your location is used only inside your browser to compute a straight-line distance — it is never
              stored or sent anywhere.
            </p>
            {geo.status === "granted" && geo.coords ? (
              straightFromUser != null ? (
                <div data-testid="pandal-detail-straight-distance">
                  <p className="font-heading text-2xl font-bold">{formatDistance(straightFromUser)}</p>
                  <p className="text-xs text-muted-foreground">straight-line — a real walking route will be longer</p>
                  <a
                    href={dirUrlFor(p, "walking")}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="pandal-detail-walking-directions-link"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium hover:border-primary/50"
                  >
                    <Footprints className="size-4" aria-hidden /> Get walking route in Google Maps
                  </a>
                </div>
              ) : (
                <NotVerified what="A distance from you (no verified pin)" />
              )
            ) : (
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  data-testid="geolocation-trigger-button"
                  onClick={geo.request}
                  disabled={geo.status === "locating"}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium transition-transform duration-100 active:scale-[0.98] disabled:opacity-60"
                >
                  <LocateFixed className="size-4" aria-hidden />
                  {geo.status === "locating" ? "Locating…" : "Use my current location"}
                </button>
                {geo.message && (
                  <p data-testid="geolocation-error-message" className="text-xs text-destructive" role="alert">
                    {geo.message}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-5" data-testid="pandal-detail-verification-panel">
            <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold">
              <ShieldCheck className="size-4 text-primary" aria-hidden /> Verification
            </h2>
            <p className="text-sm">
              Status: <VerificationBadge status={p.verificationStatus} />
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Checked fields:{" "}
              <span data-testid="pandal-detail-verified-fields" className="font-mono text-xs">
                {p.verifiedFields.join(", ") || "none yet"}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Puja 2026 status:{" "}
              <span className="font-medium text-foreground">
                {p.puja2026Status === "confirmed" ? "Confirmed" : "Not confirmed by the organisers yet"}
              </span>{" "}
              · last checked {p.lastVerifiedAt}
            </p>
            <p className="mt-3 text-xs">
              Sources:{" "}
              {p.sourceUrls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="mr-3 inline-flex items-center gap-1 text-primary hover:underline">
                  {u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 44)} <ExternalLink className="size-3" aria-hidden />
                </a>
              ))}
            </p>
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-3">
          <div className="relative">
            <PandalMap
              pandals={mapPandals}
              selectedId={p.id}
              showAccuracy
              className="h-[46vh] min-h-[320px] w-full rounded-xl border border-border/70 lg:h-[60vh]"
            />
            {approx && (
              <p className="absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
                Approximate neighbourhood pin — circle shows the uncertainty area
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Map tiles © OpenStreetMap contributors · pins and metro stations from openly-licensed data
          </p>

          <section data-testid="pandal-detail-nearby-section">
            <h2 className="mb-4 font-heading text-xl font-bold">Pandals nearby</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {nearby.map((x) => (
                <PandalCard key={x.id} pandal={x} userCoords={geo.coords} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
