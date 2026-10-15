import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarHeart, Route } from "lucide-react";
import { apiGet } from "@/lib/api";
import { dayLabel, shortDate } from "@/lib/puja";
import type { PujaToday } from "@/lib/puja";

function useCountdown(seconds: number, fetchedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, seconds - Math.floor((now - fetchedAt) / 1000));
}

function Countdown({ seconds, fetchedAt }: { seconds: number; fetchedAt: number }) {
  const left = useCountdown(seconds, fetchedAt);
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const parts: [number, string][] = [
    [d, "d"],
    [h, "h"],
    [m, "m"],
    [s, "s"],
  ];
  return (
    <span data-testid="puja-banner-countdown" className="inline-flex gap-1.5 font-mono text-sm tabular-nums">
      {parts.map(([v, u]) => (
        <span key={u} className="rounded bg-[#FFF8F0]/15 px-1.5 py-0.5">
          {String(v).padStart(2, "0")}
          <span className="text-[#F5D061]">{u}</span>
        </span>
      ))}
    </span>
  );
}

/** Server-anchored "which puja day is it" strip. Renders nothing if the backend is unreachable. */
export function PujaBanner() {
  const { data, dataUpdatedAt, isError } = useQuery({
    queryKey: ["puja", "today"],
    queryFn: () => apiGet<PujaToday>("/puja/today"),
    staleTime: 10 * 60_000,
    refetchInterval: 30 * 60_000,
    retry: 1,
  });
  if (!data || isError) return null;

  return (
    <div data-testid="puja-banner" className="bg-[#7A1712] text-[#FFF8F0]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <CalendarHeart className="size-4 shrink-0 text-[#F5D061]" aria-hidden />
        {data.phase === "before" && (
          <>
            <span data-testid="puja-banner-text">
              <span className="font-semibold">Shashthi in {data.days_until_start} {data.days_until_start === 1 ? "day" : "days"}</span>
              <span className="text-[#E0CEBC]"> · Puja starts {shortDate(data.start_date)}</span>
            </span>
            <Countdown seconds={data.seconds_until_start} fetchedAt={dataUpdatedAt} />
          </>
        )}
        {data.phase === "during" && data.current && (
          <>
            <span data-testid="puja-banner-text">
              <span className="text-[#E0CEBC]">Today is </span>
              <span className="font-semibold text-[#F5D061]">Shubho {dayLabel(data.current)}</span>
              {data.next && <span className="text-[#E0CEBC]"> · next: {dayLabel(data.next)} {shortDate(data.next.date)}</span>}
            </span>
            <Link
              to={`/planner?day=${data.current.key}`}
              data-testid="puja-banner-route-link"
              className="inline-flex items-center gap-1 rounded-md border border-[#F5D061]/50 px-2 py-0.5 text-xs font-medium text-[#F5D061] transition-colors duration-150 hover:bg-[#F5D061]/10"
            >
              <Route className="size-3.5" aria-hidden /> Today's route
            </Link>
          </>
        )}
        {data.phase === "after" && (
          <span data-testid="puja-banner-text">
            <span className="font-semibold">Shubho Bijoya</span>
            <span className="text-[#E0CEBC]"> · Asche bochor abar hobe — see you next Puja.</span>
          </span>
        )}
      </div>
    </div>
  );
}
