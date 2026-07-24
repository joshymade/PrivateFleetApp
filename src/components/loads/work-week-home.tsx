import Link from "next/link";
import { CompleteLoadButton } from "@/components/loads/complete-load-button";
import { DepartStopButton } from "@/components/loads/depart-stop-button";
import { StopTrailerField } from "@/components/loads/stop-trailer-field";
import {
  drivenMiles,
  formatCardMonthDay,
  formatCardWeekday,
} from "@/lib/loads/date";
import {
  resolveCurrentStop,
  shouldShowCompleteLoadOnHome,
  stopTypeLabel,
  stopTypeNameClass,
} from "@/lib/loads/format";
import type { AdpEntry, Load } from "@/types/database";
import type { LoadWithStops } from "@/lib/loads/queries";

export type WorkWeekDaySummary = {
  date: string;
  isOffDay: boolean;
  isToday: boolean;
  loadCount: number;
  /** null → show "—" (e.g. active load with no pay yet). */
  totalEarnings: number | null;
  /** null → show "—" until odometer pair makes driven computable. */
  totalDrivenMiles: number | null;
  /** Day card includes an in-progress active load (live preview). */
  includesActivePreview: boolean;
};

export type WorkStatsSummary = {
  weekLoads: number;
  weekEarnings: number;
  monthLoads: number;
  monthEarnings: number;
};

function currency(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function milesLabel(miles: number): string {
  return `${miles.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} mi`;
}

/**
 * Per-day card totals for the work-week grid.
 * Non-today days: completed loads only.
 * Day matching an active load's `load_date`: completed + live active preview.
 * Work Stats strip stays completed-only via {@link summarizeWorkWeekStats}.
 */
export function summarizeWorkWeekDays(
  days: string[],
  loads: Load[],
  offDays: number[],
  today: string,
  activeLoad: Pick<
    Load,
    | "id"
    | "load_date"
    | "status"
    | "pay_amount"
    | "starting_mileage"
    | "ending_mileage"
  > | null = null,
): WorkWeekDaySummary[] {
  const offSet = new Set(offDays);
  const byDate = new Map<string, Load[]>();
  for (const load of loads) {
    const list = byDate.get(load.load_date) ?? [];
    list.push(load);
    byDate.set(load.load_date, list);
  }

  // Ensure active load appears on its load_date card even if week fetch missed it.
  if (
    activeLoad?.status === "active" &&
    !((byDate.get(activeLoad.load_date) ?? []).some((l) => l.id === activeLoad.id))
  ) {
    const list = byDate.get(activeLoad.load_date) ?? [];
    list.push(activeLoad as Load);
    byDate.set(activeLoad.load_date, list);
  }

  return days.map((date) => {
    const [y, m, d] = date.split("-").map(Number);
    const weekday = new Date(y, m - 1, d).getDay();
    const onDay = byDate.get(date) ?? [];
    const completed = onDay.filter((load) => load.status === "completed");

    const previewActive =
      activeLoad?.status === "active" && activeLoad.load_date === date
        ? activeLoad
        : (onDay.find((load) => load.status === "active") ?? null);

    const includesActivePreview = previewActive != null;
    const loadCount =
      completed.length +
      (previewActive && !completed.some((c) => c.id === previewActive.id)
        ? 1
        : 0);

    let earningsSum = 0;
    let hasPay = false;
    let drivenSum = 0;
    let hasDriven = false;

    for (const load of completed) {
      if (load.pay_amount != null) {
        earningsSum += Number(load.pay_amount);
        hasPay = true;
      }
      const driven = drivenMiles(load.starting_mileage, load.ending_mileage);
      if (driven != null) {
        drivenSum += driven;
        hasDriven = true;
      }
    }

    if (previewActive) {
      if (previewActive.pay_amount != null) {
        earningsSum += Number(previewActive.pay_amount);
        hasPay = true;
      }
      const driven = drivenMiles(
        previewActive.starting_mileage,
        previewActive.ending_mileage,
      );
      if (driven != null) {
        drivenSum += driven;
        hasDriven = true;
      }
    }

    return {
      date,
      isOffDay: offSet.has(weekday),
      isToday: date === today,
      loadCount,
      totalEarnings:
        loadCount === 0 ? 0 : hasPay ? earningsSum : includesActivePreview ? null : 0,
      totalDrivenMiles:
        loadCount === 0
          ? 0
          : hasDriven
            ? drivenSum
            : includesActivePreview
              ? null
              : 0,
      includesActivePreview,
    };
  });
}

/**
 * Week-level stats from the already-fetched week loads.
 * Work Stats only count completed loads (archived excluded).
 */
export function summarizeWorkWeekStats(loads: Load[]): {
  loadCount: number;
  earnings: number;
} {
  let loadCount = 0;
  let earnings = 0;
  for (const load of loads) {
    if (load.status === "completed") {
      loadCount += 1;
      if (load.pay_amount != null) {
        earnings += Number(load.pay_amount);
      }
    }
  }
  return { loadCount, earnings };
}

export function WorkWeekHome({
  weekLabel,
  days,
  stats,
  latestAdp,
  activeLoad,
  currentTruckNumber = null,
  canManage,
}: {
  weekLabel: string;
  days: WorkWeekDaySummary[];
  stats: WorkStatsSummary;
  latestAdp: AdpEntry | null;
  activeLoad: LoadWithStops | null;
  /** Profile fallback when active load has no truck snapshot yet. */
  currentTruckNumber?: string | null;
  canManage: boolean;
}) {
  const currentStopInfo = activeLoad
    ? resolveCurrentStop(activeLoad.load_stops)
    : null;
  const currentStop = currentStopInfo?.stop ?? null;
  const allStopsDeparted = currentStopInfo?.allDeparted ?? false;
  const undepartedStopCount = activeLoad
    ? activeLoad.load_stops.filter((s) => !s.completed).length
    : 0;
  const showCompleteLoad =
    Boolean(activeLoad) &&
    shouldShowCompleteLoadOnHome(activeLoad?.load_stops ?? []);
  const showDepart =
    Boolean(currentStop) && !allStopsDeparted && !showCompleteLoad;
  const currentTrailer =
    activeLoad?.trailer_number?.trim() ||
    null;
  const tractorNumber =
    activeLoad?.truck_number?.trim() ||
    currentTruckNumber?.trim() ||
    null;

  return (
    <div className="space-y-4">
      {canManage ? (
        <Link
          href="/loads/new"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground"
        >
          Quick add load
        </Link>
      ) : null}

      {activeLoad ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm dark:border-blue-800/70 dark:bg-blue-950/40">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700/80 dark:text-blue-200/75">
                Active load
              </p>
              <Link
                href={`/loads/${activeLoad.id}/edit`}
                className="mt-0.5 block truncate text-lg font-semibold text-blue-950 underline-offset-2 hover:underline dark:text-blue-50"
              >
                #{activeLoad.load_number}
              </Link>
            </div>
            <Link
              href={`/loads/${activeLoad.id}/edit`}
              className="shrink-0 text-sm font-medium text-blue-800 underline-offset-2 hover:underline dark:text-blue-100"
            >
              Open →
            </Link>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-blue-700/70 dark:text-blue-200/65">
                Tractor
              </dt>
              <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-blue-950 dark:text-blue-50">
                {tractorNumber ?? "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-blue-700/70 dark:text-blue-200/65">
                Trailer
              </dt>
              <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-blue-950 dark:text-blue-50">
                {currentTrailer ?? "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-3 border-t border-blue-200 pt-3 dark:border-blue-800/60">
            <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700/70 dark:text-blue-200/65">
              Current stop
            </p>
            {!currentStop ? (
              <p className="mt-1 text-sm text-blue-900/80 dark:text-blue-100/80">
                No stops on this load
              </p>
            ) : (
              <>
                {allStopsDeparted ? (
                  <p className="mt-1 text-xs font-medium text-blue-700/80 dark:text-blue-200/75">
                    All stops departed
                  </p>
                ) : null}
                <p
                  className={
                    allStopsDeparted
                      ? "mt-0.5 text-sm text-blue-950/85 dark:text-blue-50/85"
                      : "mt-1 text-sm text-blue-950 dark:text-blue-50"
                  }
                >
                  <span className="font-medium text-blue-800/80 dark:text-blue-200/75">
                    #{currentStop.delivery_order} ·{" "}
                    {stopTypeLabel(currentStop.stop_type)} ·{" "}
                  </span>
                  <span
                    className={`font-semibold ${stopTypeNameClass(currentStop.stop_type)}`}
                  >
                    {currentStop.stop_name}
                  </span>
                  {currentStop.pickup_number?.trim() ? (
                    <>
                      <span className="text-blue-800/75 dark:text-blue-200/70">
                        {" "}
                        · Pickup{" "}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {currentStop.pickup_number.trim()}
                      </span>
                    </>
                  ) : null}
                </p>
              </>
            )}

            {currentStop && !allStopsDeparted ? (
              <div className="mt-2.5">
                <StopTrailerField
                  key={`${currentStop.id}-${currentStop.trailer_number ?? ""}`}
                  stopId={currentStop.id}
                  trailerNumber={currentStop.trailer_number}
                  canEdit={canManage}
                  variant="form"
                />
              </div>
            ) : currentStop && allStopsDeparted ? (
              <p className="mt-2 text-xs text-blue-700/70 dark:text-blue-200/65">
                Trailer add unavailable — all stops departed.
              </p>
            ) : null}

            {canManage && showDepart && currentStop ? (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs text-blue-700/75 dark:text-blue-200/70">
                  Depart this stop to advance to the next.
                </p>
                <DepartStopButton stopId={currentStop.id} />
              </div>
            ) : null}

            {canManage && showCompleteLoad && activeLoad ? (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs text-blue-700/75 dark:text-blue-200/70">
                  {allStopsDeparted
                    ? "All stops departed — enter ending mileage and pay to close this load."
                    : undepartedStopCount === 1
                      ? "Last stop — enter ending mileage and pay to complete this load."
                      : "Enter ending mileage and pay to close this load."}
                </p>
                <CompleteLoadButton
                  loadId={activeLoad.id}
                  loadDate={activeLoad.load_date}
                  startingMileage={
                    activeLoad.starting_mileage != null
                      ? Number(activeLoad.starting_mileage)
                      : null
                  }
                  variant="home"
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3 px-0.5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Current work week
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{weekLabel}</p>
          </div>
          <div className="shrink-0 rounded-xl border border-border bg-muted/60 px-3 py-2 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Latest ADP
            </p>
            {latestAdp ? (
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {currency(Number(latestAdp.adp_amount))}
              </p>
            ) : (
              <Link
                href="/account"
                className="mt-0.5 block text-xs font-medium text-brand underline-offset-2 hover:underline"
              >
                Add in Account
              </Link>
            )}
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {days.map((day) => (
            <li key={day.date} className="min-w-0">
              <WorkWeekDayCard day={day} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="px-0.5 text-base font-semibold text-foreground">
          Work Stats
        </h2>
        <ul className="grid grid-cols-2 gap-2.5">
          <li className="min-w-0">
            <WorkStatCard
              label="Total completed loads"
              value={String(stats.weekLoads)}
              hint="This week"
            />
          </li>
          <li className="min-w-0">
            <WorkStatCard
              label="Total completed loads"
              value={String(stats.monthLoads)}
              hint="This month"
            />
          </li>
          <li className="min-w-0">
            <WorkStatCard
              label="Week earnings"
              value={currency(stats.weekEarnings)}
              hint="Completed loads"
            />
          </li>
          <li className="min-w-0">
            <WorkStatCard
              label="Month earnings"
              value={currency(stats.monthEarnings)}
              hint="Completed loads"
            />
          </li>
        </ul>
      </section>
    </div>
  );
}

function WorkStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-card px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </article>
  );
}

function WorkWeekDayCard({ day }: { day: WorkWeekDaySummary }) {
  const weekday = formatCardWeekday(day.date);
  const monthDay = formatCardMonthDay(day.date);
  const hasLoads = day.loadCount > 0;

  return (
    <article
      className={[
        "flex h-full min-h-[7.5rem] flex-col rounded-2xl border px-3 py-3",
        day.isToday
          ? "border-accent/80 bg-accent/10 ring-1 ring-accent/40"
          : day.isOffDay
            ? "border-dashed border-border bg-muted/40"
            : "border-border bg-card",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {weekday}
          </p>
          <p className="text-xs text-muted-foreground">{monthDay}</p>
        </div>
        {day.isOffDay ? (
          <span className="shrink-0 rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Off
          </span>
        ) : day.isToday ? (
          <span className="shrink-0 rounded-md bg-accent/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
            Today
          </span>
        ) : null}
      </div>

      {hasLoads ? (
        <dl className="mt-auto space-y-1 pt-2.5 text-xs">
          {day.includesActivePreview ? (
            <p className="text-[10px] font-medium uppercase tracking-wide text-accent-foreground/80">
              In progress
            </p>
          ) : null}
          <div className="flex items-baseline justify-between gap-1">
            <dt className="text-muted-foreground">Loads</dt>
            <dd className="font-semibold tabular-nums">{day.loadCount}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <dt className="text-muted-foreground">Earn</dt>
            <dd className="truncate font-semibold tabular-nums">
              {day.totalEarnings == null ? "—" : currency(day.totalEarnings)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <dt className="text-muted-foreground">Driven</dt>
            <dd className="truncate font-semibold tabular-nums">
              {day.totalDrivenMiles == null
                ? "—"
                : milesLabel(day.totalDrivenMiles)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-auto rounded-xl border border-dashed border-border/80 bg-background/50 px-2 py-2 text-center text-xs text-muted-foreground dark:bg-background/20">
          No load logged
        </p>
      )}
    </article>
  );
}
