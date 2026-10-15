import { Users } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { CROWD_LABEL, CROWD_STYLE, useCrowdSummary, useReportCrowd } from "@/lib/crowd";
import type { CrowdLevel } from "@/lib/crowd";
import { cn } from "@/lib/utils";

const LEVELS: CrowdLevel[] = ["easy", "busy", "packed"];

/** Small chip for cards: only renders when there are recent reports. */
export function CrowdChip({ pandalId }: { pandalId: string }) {
  const { data } = useCrowdSummary();
  const s = data?.get(pandalId);
  if (!s) return null;
  return (
    <span
      data-testid="pandal-card-crowd-chip"
      title={`${s.reports} visitor report(s), latest ${s.minutes_ago} min ago`}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", CROWD_STYLE[s.level])}
    >
      <Users className="size-3" aria-hidden /> {CROWD_LABEL[s.level]}
    </span>
  );
}

/** Detail-page panel: current crowd + one-tap report. */
export function CrowdPanel({ pandalId, pandalName }: { pandalId: string; pandalName: string }) {
  const { data, isError } = useCrowdSummary();
  const report = useReportCrowd();
  const s = data?.get(pandalId);

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5" data-testid="crowd-panel">
      <h2 className="mb-2 flex items-center gap-2 font-heading text-lg font-bold">
        <Users className="size-4 text-primary" aria-hidden /> Crowd right now
      </h2>
      {isError ? (
        <p className="text-sm text-muted-foreground">Live crowd reports are unavailable at the moment.</p>
      ) : s ? (
        <div data-testid="crowd-panel-status" className="mb-3 text-sm">
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold", CROWD_STYLE[s.level])}>
            {CROWD_LABEL[s.level]}
          </span>
          <span className="ml-2 text-muted-foreground">
            {s.reports} report{s.reports === 1 ? "" : "s"} · latest {s.minutes_ago === 0 ? "just now" : `${s.minutes_ago} min ago`}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">
            Easy {s.easy} · Busy {s.busy} · Packed {s.packed} — from visitors, last 90 minutes
          </p>
        </div>
      ) : (
        <p data-testid="crowd-panel-empty" className="mb-3 text-sm text-muted-foreground">
          No reports in the last 90 minutes. At the pandal? Tell others how it looks.
        </p>
      )}

      {!isError && (
        <>
          <p className="mb-2 text-xs font-medium text-muted-foreground">How busy is it?</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Report crowd at ${pandalName}`}>
            {LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                data-testid={`crowd-report-${lv}`}
                disabled={report.isPending}
                onClick={() =>
                  report.mutate(
                    { pandalId, level: lv },
                    {
                      onSuccess: () => toast(`Thanks — reported “${CROWD_LABEL[lv]}”`, { description: "Reports fade after 90 minutes." }),
                      onError: (e) =>
                        toast(
                          e instanceof ApiError && e.status === 429
                            ? "You reported this pandal a few minutes ago — try again in 10 minutes."
                            : "Couldn't send your report. Please try again.",
                        ),
                    },
                  )
                }
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-semibold transition-[transform,opacity] duration-100 active:scale-[0.97] disabled:opacity-50",
                  CROWD_STYLE[lv],
                )}
              >
                {CROWD_LABEL[lv]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Anonymous. One report per pandal every 10 minutes from this device.</p>
        </>
      )}
    </section>
  );
}
