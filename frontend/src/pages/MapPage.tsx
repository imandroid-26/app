import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PandalMap } from "@/components/PandalMap";
import { PANDALS, ZONES, searchPandals } from "@/lib/pandals";
import { useGeoLocation } from "@/lib/useGeo";
import { cn } from "@/lib/utils";

export default function MapPage() {
  const navigate = useNavigate();
  const geo = useGeoLocation();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const zonesRaw = params.get("zones") ?? "";
  const zones = useMemo(() => zonesRaw.split(",").filter(Boolean), [zonesRaw]);

  const filtered = useMemo(() => {
    const base = searchPandals(q);
    return zones.length ? base.filter((p) => zones.includes(p.zone)) : base;
  }, [q, zones]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {ZONES.map((z) => {
            const active = zones.includes(z.code);
            return (
              <button
                key={z.code}
                type="button"
                data-testid={`map-zone-filter-${z.code}`}
                aria-pressed={active}
                onClick={() => {
                  setParams(
                    (prev) => {
                      const cur = (prev.get("zones") ?? "").split(",").filter(Boolean);
                      const next = cur.includes(z.code) ? cur.filter((x) => x !== z.code) : [...cur, z.code];
                      const p = new URLSearchParams(prev);
                      if (next.length) p.set("zones", next.join(","));
                      else p.delete("zones");
                      return p;
                    },
                    { replace: true },
                  );
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                  !active && "opacity-80",
                )}
                style={{ backgroundColor: z.hex, borderColor: z.hex, color: "#FFF8F0" }}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: active ? "#FFF8F0" : "transparent", boxShadow: active ? "none" : "inset 0 0 0 1.5px #FFF8F0" }} aria-hidden />
                {z.short}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground" data-testid="map-page-count">
          {filtered.length} pins · hollow pins = approximate neighbourhood anchor
        </p>
      </div>
      <PandalMap
        pandals={filtered}
        className="h-[calc(100vh-7rem)] w-full"
        onDetails={(id) => navigate(`/pandal/${id}`)}
        userCoords={geo.coords}
      />
      <p className="px-4 py-2 text-xs text-muted-foreground sm:px-6 lg:px-8">
        Map data © OpenStreetMap contributors (ODbL). Pandals with only a neighbourhood anchor are drawn hollow —
        {PANDALS.filter((p) => p.locationAccuracy === "approximate").length} records total.
      </p>
    </div>
  );
}
