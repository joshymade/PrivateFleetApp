import { MaskedMoney } from "@/components/ui/masked-money";
import { formatDurationHm } from "@/lib/loads/shift-time";
import type { MonthLoadTotals } from "@/lib/loads/queries";
import {
  formatMilesNumber,
  formatSignedMiles,
  unpaidMilesDisplay,
  unpaidMilesToneClass,
} from "@/lib/loads/unpaid-miles";

export function LoadsMonthTotals({ totals }: { totals: MonthLoadTotals }) {
  const unpaidDisplay = unpaidMilesDisplay(
    totals.drivenMiles,
    totals.paidMiles,
  );

  return (
    <section className="rounded-2xl border border-border bg-background p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Month totals
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Latest ADP</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            <MaskedMoney amount={totals.latestAdp} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            Earnings (current calculation)
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            <MaskedMoney amount={totals.earnings} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Driven versus Paid miles</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {formatMilesNumber(totals.drivenMiles)} /{" "}
            {formatMilesNumber(totals.paidMiles)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Unpaid Miles Driven</dt>
          <dd
            className={`mt-0.5 text-lg font-semibold tabular-nums ${unpaidMilesToneClass(unpaidDisplay)}`}
          >
            {formatSignedMiles(unpaidDisplay)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Completed loads</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {totals.completedLoads}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Hours worked</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {formatDurationHm(totals.workedMinutes)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
