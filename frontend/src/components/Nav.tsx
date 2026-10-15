import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTheme } from "next-themes";
import { Heart, Map, Menu, Moon, Route, Search, Sun, X } from "lucide-react";
import { useFavourites } from "@/lib/favourites";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Home", testid: "nav-link-home", end: true },
  { to: "/explore", label: "Explore", testid: "nav-link-explore", end: false },
  { to: "/map", label: "Map", testid: "nav-link-map", end: false },
  { to: "/my-pujas", label: "My Pujas", testid: "nav-link-favourites", end: false },
  { to: "/planner", label: "Route Planner", testid: "nav-link-itinerary", end: false },
  { to: "/guide", label: "Ask Guide", testid: "nav-link-guide", end: false },
];

function BrandMark() {
  // small diya glyph drawn with the festive palette
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <path d="M12 2c1.8 2.6 2.7 4.6 2.7 6.2 0 2-1.2 3.3-2.7 3.3S9.3 10.2 9.3 8.2C9.3 6.6 10.2 4.6 12 2Z" fill="#C8281E" />
      <path
        d="M4 15c1.6 3.4 4.4 5.5 8 5.5s6.4-2.1 8-5.5c-2.2 1.5-4.9 2.3-8 2.3S6.2 16.5 4 15Z"
        fill="#C69214"
      />
      <path d="M5.5 13.2h13" stroke="#C69214" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Nav() {
  const fav = useFavourites();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" data-testid="nav-brand-logo" className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight">
          <BrandMark />
          PujoPath
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              data-testid={l.testid}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/my-pujas"
            data-testid="nav-favourites-pill"
            aria-label={`My Pujas: ${fav.ids.length} saved`}
            className="hidden items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:border-primary/50 sm:inline-flex"
          >
            <Heart className="size-4 text-primary" aria-hidden />
            <span>{fav.ids.length}</span>
          </Link>
          <button
            type="button"
            data-testid="theme-toggle-button"
            aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="rounded-md border border-border/70 p-2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            {resolvedTheme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
          </button>
          <button
            type="button"
            className="rounded-md border border-border/70 p-2 md:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            data-testid="nav-mobile-menu-button"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* mobile sheet */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-64 border-l border-border bg-background p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-heading font-bold">PujoPath</span>
              <button type="button" aria-label="Close menu" data-testid="nav-mobile-close-button" onClick={() => setOpen(false)} className="p-2">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  data-testid={`${l.testid}-mobile`}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
                    )
                  }
                >
                  {l.label === "Explore" && <Search className="size-4" aria-hidden />}
                  {l.label === "Map" && <Map className="size-4" aria-hidden />}
                  {l.label === "Route Planner" && <Route className="size-4" aria-hidden />}
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
