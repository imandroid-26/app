import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Map, Route, Search, ShieldCheck, TrainFront } from "lucide-react";
import { PANDALS, TOTALS, ZONES, featuredPandals, zoneCounts } from "@/lib/pandals";
import { PandalCard } from "@/components/PandalCard";
import { useGeoLocation } from "@/lib/useGeo";

const PUJA_DAYS = [
  { day: "Mahalaya", date: "Sat 10 Oct" },
  { day: "Shashthi", date: "Fri 16 Oct" },
  { day: "Saptami", date: "Sat 17 Oct" },
  { day: "Ashtami", date: "Sun 18 Oct" },
  { day: "Navami", date: "Mon 19 Oct" },
  { day: "Dashami", date: "Wed 21 Oct" },
];

export default function Home() {
  const navigate = useNavigate();
  const geo = useGeoLocation();
  const counts = zoneCounts();
  const featured = featuredPandals();

  return (
    <div className="flex flex-col">
      {/* ---------------- hero ---------------- */}
      <section className="relative isolate overflow-hidden">
        <img
          src="/hero-durga.jpg"
          alt="Maa Durga idol lit by warm lamps during Kolkata's Durga Puja"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_center]"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to right, rgba(20,10,8,0.94) 0%, rgba(20,10,8,0.78) 45%, rgba(20,10,8,0.35) 100%), linear-gradient(to top, rgba(20,10,8,0.95) 0%, transparent 60%)",
          }}
          aria-hidden
        />
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F5D061]">
            Durga Puja 2026 · Kolkata
          </p>
          <h1 className="max-w-xl font-heading text-4xl font-bold leading-tight tracking-tight text-[#FFF8F0] sm:text-5xl lg:text-6xl">
            Every pandal.
            <br />
            The nearest metro.
            <br />
            <span className="text-[#F5D061]">One Day at a time.</span>
          </h1>
          <p className="max-w-lg text-base text-[#E0CEBC]">
            {TOTALS.pandals} pandals across Kolkata, mapped with verified locations, nearest
            metro stations and one-tap Google Maps directions.
          </p>

          <form
            className="flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              navigate(`/explore?q=${encodeURIComponent(String(q ?? ""))}`);
            }}
          >
            <label htmlFor="hero-search" className="sr-only">
              Search pandals
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#B5A79E]" aria-hidden />
              <input
                id="hero-search"
                name="q"
                data-testid="hero-search-input"
                placeholder="Try “Ekdalia”, “Kasba” or “Girish Park”"
                className="h-11 w-full rounded-lg border border-[#5C4F46]/60 bg-[#1C1613]/70 pl-9 pr-3 text-sm text-[#FFF8F0] placeholder:text-[#B5A79E]/80 focus:border-[#F5D061] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              data-testid="hero-explore-button"
              className="h-11 rounded-lg bg-[#C8281E] px-4 text-sm font-semibold text-[#FFF8F0] transition-transform duration-100 hover:bg-[#b3231a] active:scale-[0.98]"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 rounded-lg border border-[#F5D061]/50 px-4 py-2 text-sm font-medium text-[#F5D061] transition-colors duration-150 hover:bg-[#F5D061]/10"
            >
              Explore all pandals <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              to="/planner"
              className="inline-flex items-center gap-2 rounded-lg border border-[#5C4F46]/70 px-4 py-2 text-sm font-medium text-[#E0CEBC] transition-colors duration-150 hover:border-[#F5D061]/50 hover:text-[#F5D061]"
            >
              <Route className="size-4" aria-hidden /> Plan a route
            </Link>
          </div>
        </div>

        {/* stat strip */}
        <div className="border-t border-[#5C4F46]/40 bg-[#120F0D]/70">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-sm sm:grid-cols-4 sm:px-6 lg:px-8">
            <div>
              <dt className="text-[#B5A79E]">Pandals</dt>
              <dd className="font-heading text-xl font-bold text-[#FFF8F0]" data-testid="home-stat-pandals">
                {TOTALS.pandals}
              </dd>
            </div>
            <div>
              <dt className="text-[#B5A79E]">Zones</dt>
              <dd className="font-heading text-xl font-bold text-[#FFF8F0]">{TOTALS.zones}</dd>
            </div>
            <div>
              <dt className="text-[#B5A79E]">Metro stations served</dt>
              <dd className="font-heading text-xl font-bold text-[#FFF8F0]" data-testid="home-stat-metro">
                {TOTALS.metroStations}
              </dd>
            </div>
            <div>
              <dt className="text-[#B5A79E]">Verified map pins</dt>
              <dd className="font-heading text-xl font-bold text-[#FFF8F0]" data-testid="home-stat-verified">
                {TOTALS.verifiedPins}/{TOTALS.pandals}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ---------------- puja dates ---------------- */}
      <section className="border-b border-border/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm sm:px-6 lg:px-8">
          <span className="font-semibold uppercase tracking-[0.14em] text-xs text-gold-dark">
            Puja 2026
          </span>
          {PUJA_DAYS.map((d) => (
            <span key={d.day} className="text-muted-foreground">
              <span className="font-medium text-foreground">{d.day}</span> {d.date}
            </span>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">Dates via pujomap.com guide</span>
        </div>
      </section>

      {/* ---------------- zones ---------------- */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Pick a part of the city</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Kolkata's pujas are a walking city. Start from the belt you'll be in.
            </p>
          </div>
          <Link to="/explore" className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:inline-flex">
            Browse everything <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ZONES.map((z, i) => (
            <Link
              key={z.code}
              to={`/explore?zones=${z.code}`}
              data-testid={`home-zone-card-${z.code}`}
              className="group flex flex-col justify-between gap-8 rounded-xl border border-border/70 bg-card p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-[0_14px_34px_-16px_rgb(28_22_19/0.35)] motion-safe:animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="inline-flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${z.hex}1A` }}>
                <span className="size-3.5 rounded-full" style={{ backgroundColor: z.hex }} aria-hidden />
              </span>
              <span>
                <span className="block font-heading text-lg font-bold leading-snug">{z.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {counts[z.code] ?? 0} pandals
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- featured ---------------- */}
      <section className="border-t border-border/70 bg-secondary/40">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">The pujas the city queues for</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Expect crowds Saptami–Navami evenings. Every card carries its nearest metro.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featured.map((p) => (
              <PandalCard key={p.id} pandal={p} userCoords={geo.coords} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- honest data note ---------------- */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-xl border border-gold/30 bg-card p-6 sm:flex-row sm:items-start">
          <ShieldCheck className="size-6 shrink-0 text-gold-dark" aria-hidden />
          <div className="text-sm leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">How the data stays honest</p>
            <p className="mt-1">
              All {TOTALS.pandals} records were imported from the openly-licensed (ODbL) directory at
              pujomap.com, with metro stations and lines cross-checked against OpenStreetMap. Where a
              pin only anchors a neighbourhood — or a metro distance looks off — the record is labelled
              "Partially verified", "Name only" or "Needs review" instead of pretending to be certain.
              Walking times are clearly-marked estimates; tap Directions and let Google Maps compute the
              real route.
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <Map className="size-3.5" aria-hidden /> Map tiles © OpenStreetMap contributors
              </span>
              <span className="inline-flex items-center gap-1">
                <TrainFront className="size-3.5" aria-hidden /> Metro data © OpenStreetMap (ODbL)
              </span>
              <span>Import report: /app/IMPORT_REPORT.md in the repository</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
