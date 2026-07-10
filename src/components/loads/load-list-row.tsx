import Link from "next/link";
import { driverIdClassName } from "@/components/ui/driver-id";
import { formatShortDate } from "@/lib/loads/date";
import { RouteSnippet } from "@/components/loads/route-snippet";
import { formatTrailerSequence, statusLabel } from "@/lib/loads/format";
import type { LoadWithStops } from "@/lib/loads/queries";

export function LoadListRow({ load }: { load: LoadWithStops }) {
  return (
    <Link
      href={`/loads/${load.id}`}
      className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0 active:bg-muted"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {formatShortDate(load.load_date)} ·{" "}
          <span className={driverIdClassName}>#{load.load_number}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Trailer(s) {formatTrailerSequence(load, load.load_stops)} ·{" "}
          <RouteSnippet load={load} />
        </p>
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {statusLabel(load.status)}
      </span>
    </Link>
  );
}
