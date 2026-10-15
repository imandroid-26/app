import { ShieldCheck, AlertCircle, MapPinOff, HelpCircle } from "lucide-react";
import type { VerificationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Badge texts follow the verification rubric: never present unverified data as
// confirmed. "Verified" = important location info checked against sources; the
// per-field detail lives on the pandal page.
const CONFIG: Record<VerificationStatus, { label: string; icon: typeof ShieldCheck; cls: string; title: string }> = {
  verified: {
    label: "Verified",
    icon: ShieldCheck,
    cls: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900",
    title: "Name, coordinates and nearest metro checked against the reference directory and OpenStreetMap",
  },
  partially_verified: {
    label: "Partially verified",
    icon: AlertCircle,
    cls: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900",
    title: "Some details confirmed; other fields still uncertain",
  },
  name_only: {
    label: "Name only · approximate pin",
    icon: MapPinOff,
    cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    title: "Exact location not verified — the pin only anchors the neighbourhood",
  },
  needs_review: {
    label: "Needs review",
    icon: HelpCircle,
    cls: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900",
    title: "Conflicting or insufficient evidence — see the review note",
  },
};

export function VerificationBadge({ status, className }: { status: VerificationStatus; className?: string }) {
  const c = CONFIG[status];
  const Icon = c.icon;
  return (
    <span
      title={c.title}
      data-testid={`verification-badge-${status}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        c.cls,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {c.label}
    </span>
  );
}
