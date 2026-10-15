import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";

export type CrowdLevel = "easy" | "busy" | "packed";

// Mirrors of the Pydantic models in backend/models/crowd.py.
export interface CrowdSummary {
  pandal_id: string;
  level: CrowdLevel;
  reports: number;
  easy: number;
  busy: number;
  packed: number;
  latest_at: string;
  minutes_ago: number;
}

export interface CrowdReport {
  id: string;
  pandal_id: string;
  level: CrowdLevel;
  client_id: string;
  created_at: string;
}

export const CROWD_LABEL: Record<CrowdLevel, string> = {
  easy: "Easy",
  busy: "Busy",
  packed: "Packed",
};

export const CROWD_STYLE: Record<CrowdLevel, string> = {
  easy: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900",
  busy: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900",
  packed: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900",
};

const CLIENT_KEY = "pujopath_client_id";

/** Anonymous random device id — only used to stop one phone spamming reports. */
export function clientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return "anon-session-device";
  }
}

const SUMMARY_KEY = ["crowd", "summary"] as const;

/** All pandals with reports in the last 90 minutes, keyed by pandal id. */
export function useCrowdSummary() {
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: () => apiGet<CrowdSummary[]>("/crowd/summary"),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
    select: (rows) => new Map(rows.map((r) => [r.pandal_id, r])),
  });
}

export function useReportCrowd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { pandalId: string; level: CrowdLevel }) =>
      apiPost<CrowdReport>("/crowd/reports", { pandal_id: v.pandalId, level: v.level, client_id: clientId() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUMMARY_KEY }),
  });
}
