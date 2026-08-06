import Link from "next/link";
import { LoadLabel } from "@/components/loads/load-label";
import { MaskedMoney } from "@/components/ui/masked-money";
import { sectionHeadingColorClassName } from "@/components/ui/page-title";
import { drivenMiles, formatShortDate } from "@/lib/loads/date";
import { RouteSnippet } from "@/components/loads/route-snippet";
import {
  formatTrailerSequence,
  statusBadgeClassName,
  statusLabel,
} from "@/lib/loads/format";
import type { LoadWithStops } from "@/lib/loads/queries";
import {
  formatSignedMiles,
  unpaidMilesDisplay,
  unpaidMilesToneClass,
} from "@/lib/loads/unpaid-miles";

export function LoadCard({ load }: { load: LoadWithStops }) {
  const driven = drivenMiles(load.starting_mileage, load.ending_mileage);
  // No odometer pair → driven unknown → unpaid treated as 0
  const unpaidDisplay =
    driven == null
      ? 0
      : unpaidMilesDisplay(
          driven,
          load.paid_miles != null ? Number(load.paid_miles) : 0,
        );
  const truck = load.truck_number?.trim() || null;

  return (
    <Link
      href={`/loads/${load.id}`}
      className="block rounded-2xl border border-border bg-background p-4 shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {formatShortDate(load.load_date)}
          </p>
          <h3
            className={`mt-1 text-lg font-semibold tracking-tight ${sectionHeadingColorClassName}`}
          >            <LoadLabel loadNumber={load.load_number} />
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClassName(load.status)}`}
        >
          {statusLabel(load.status)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Truck</dt>
          <dd className="font-medium text-foreground">{truck ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Trailer(s)</dt>
          <dd className="font-medium text-foreground">
            {formatTrailerSequence(load, load.load_stops)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Paid miles</dt>
          <dd className="font-medium text-foreground">
            {load.paid_miles != null ? load.paid_miles : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Driven miles</dt>
          <dd className="font-medium text-foreground">
            {driven != null ? driven : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Unpaid Miles</dt>
          <dd
            className={`font-medium tabular-nums ${unpaidMilesToneClass(unpaidDisplay)}`}
          >
            {formatSignedMiles(unpaidDisplay)}
          </dd>
        </div>
        {load.pay_amount != null ? (
          <div>
            <dt className="text-muted-foreground">Pay</dt>
            <dd className="font-medium text-foreground">
              <MaskedMoney amount={Number(load.pay_amount)} />
            </dd>
          </div>
        ) : null}
        <div className="col-span-2">
          <dt className="text-muted-foreground">Route</dt>
          <dd className="font-medium text-foreground">
            <RouteSnippet load={load} />
          </dd>
        </div>
      </dl>
    </Link>
  );
}
