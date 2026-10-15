import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { TOTALS } from "@/lib/pandals";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-24 text-center">
      <Compass className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="font-heading text-3xl font-bold">Lost in the para?</h1>
      <p className="text-sm text-muted-foreground">That page doesn't exist — but {TOTALS.pandals} pandals do.</p>
      <Link to="/explore" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Explore pandals
      </Link>
    </div>
  );
}
