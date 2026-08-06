import Link from "next/link";
import { CompleteLoadButton } from "@/components/loads/complete-load-button";
import { DailyEarningsRemindersProvider } from "@/components/loads/daily-earnings-reminders";
import { DailyPayDayEditor } from "@/components/loads/daily-pay-day-editor";
import { DepartStopButton } from "@/components/loads/depart-stop-button";
import { ShiftPunchDayEditor } from "@/components/loads/shift-punch-day-editor";
import { StopSealField } from "@/components/loads/stop-seal-field";
import { StopStoreCountsField } from "@/components/loads/stop-store-counts-field";
import { StopTrailerField } from "@/components/loads/stop-trailer-field";
import { MaskedMoney } from "@/components/ui/masked-money";
import { pageTitleColorClassName } from "@/components/ui/page-title";
import type { EarningsDaySnapshot } from "@/lib/loads/daily-earnings-reminder";
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
import { formatDurationHm, shiftDurationMinutes } from "@/lib/loads/shift-time";
import type { AdpEntry, DailyPayEntry, Load, ShiftPunch } from "@/types/database";
import type { LoadWithStops } from "@/lib/loads/queries";

export type WorkWeekDaySummary = {
  date: string;
  isOffDay: boolean;
  isToday: boolean;
  /** Past calendar day (before today). */
  isPast: boolean;
  /** Biweekly deposit / pay-icon day (Thursday) for this driver. */
  isPayDay: boolean;
  loadCount: number;
  /** null → show "—" (e.g. active load with no pay yet). */
  totalEarnings: number | null;
  /** null → show "—" until odometer pair makes driven computable. */
  totalDrivenMiles: number | null;
  /** Day card includes an in-progress active load (live preview). */
  includesActivePreview: boolean;
  /** Flat daily pay when the day has no loads (past empty days). */
  dailyPayAmount: number | null;
  /** Punch times for this day (if any). */
  punchStart: string | null;
  punchEnd: string | null;
  /** Complete punch duration in minutes; null if incomplete. */
  workedMinutes: number | null;
};

export type WorkStatsSummary = {
  periodLoads: number;
  periodEarnings: number;
  periodDrivenMiles: number;
  periodWorkedMinutes: number;
};

function milesLabel(miles: number): string {
  return `${miles.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} mi`;
}

/**
 * Per-day card totals for the work-week grid.
 * Non-today days: completed loads only.
 * Day matching an active load's `load_date`: completed + live active preview.
 * Work Stats strip stays completed-only via {@link summarizeWorkWeekStats}
 * (plus daily pay totals passed separately).
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
  dailyPayByDate: Map<string, number> = new Map(),
  payDayDate: string | null = null,
  punchesByDate: Map<string, Pick<ShiftPunch, "start_time" | "end_time">> = new Map(),
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

    const dailyPayAmount =
      loadCount === 0 ? (dailyPayByDate.get(date) ?? null) : null;

    const punch = punchesByDate.get(date);
    const punchStart = punch?.start_time ?? null;
    const punchEnd = punch?.end_time ?? null;

    return {
      date,
      isOffDay: offSet.has(weekday),
      isToday: date === today,
      isPast: date < today,
      isPayDay: payDayDate != null && date === payDayDate,
      loadCount,
      totalEarnings:
        loadCount === 0
          ? (dailyPayAmount ?? 0)
          : hasPay
            ? earningsSum
            : includesActivePreview
              ? null
              : 0,
      totalDrivenMiles:
        loadCount === 0
          ? 0
          : hasDriven
            ? drivenSum
            : includesActivePreview
              ? null
              : 0,
      includesActivePreview,
      dailyPayAmount,
      punchStart,
      punchEnd,
      workedMinutes: shiftDurationMinutes(punchStart, punchEnd),
    };
  });
}

/**
 * Period-level stats from loads + daily pay.
 * Stats only count completed loads (archived excluded).
 * Daily pay is included only for dates that have no loads (empty days).
 */
export function summarizeWorkWeekStats(
  loads: Load[],
  dailyPayEntries: DailyPayEntry[] = [],
): {
  loadCount: number;
  earnings: number;
  drivenMiles: number;
} {
  let loadCount = 0;
  let earnings = 0;
  let driven = 0;
  const datesWithLoads = new Set<string>();
  for (const load of loads) {
    datesWithLoads.add(load.load_date);
    if (load.status === "completed") {
      loadCount += 1;
      if (load.pay_amount != null) {
        earnings += Number(load.pay_amount);
      }
      const d = drivenMiles(load.starting_mileage, load.ending_mileage);
      if (d != null) driven += d;
    }
  }
  for (const entry of dailyPayEntries) {
    if (!datesWithLoads.has(entry.work_date)) {
      earnings += Number(entry.amount);
    }
  }
  return { loadCount, earnings, drivenMiles: driven };
}

export function WorkWeekHome({
  weekLabel,
  depositLabel = null,
  days,
  stats,
  latestAdp,
  activeLoad,
  currentTruckNumber = null,
  canManage,
  periodMode = false,
  needsPayDate = false,
  periodEnd = null,
  periodStart = null,
  reminderDays = null,
}: {
  weekLabel: string;
  /** Upcoming deposit month/day (styled in header when period mode). */
  depositLabel?: string | null;
  days: WorkWeekDaySummary[];
  stats: WorkStatsSummary;
  latestAdp: AdpEntry | null;
  activeLoad: LoadWithStops | null;
  /** Profile fallback when active load has no truck snapshot yet. */
  currentTruckNumber?: string | null;
  canManage: boolean;
  /** True when showing the 14-day pay period instead of a work week. */
  periodMode?: boolean;
  /** Prompt driver to set pay period start/end on Account. */
  needsPayDate?: boolean;
  /** Inclusive start of the visible period / week. */
  periodStart?: string | null;
  /** Friday end of the current pay period (session dismiss key). */
  periodEnd?: string | null;
  /**
   * Optional lookback + period snapshots for earnings reminders
   * (prior completed punch days outside the visible grid).
   */
  reminderDays?: EarningsDaySnapshot[] | null;
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

  /** Projected period total: day-card load pay (incl. active) + daily pay. */
  const periodProjectedEarnings = days.reduce(
    (sum, day) => sum + (day.totalEarnings ?? 0),
    0,
  );

  const daysWorked = days.filter(
    (day) =>
      day.loadCount > 0 ||
      day.dailyPayAmount != null ||
      (day.punchStart != null && day.punchEnd != null),
  ).length;

  const hoursWorked = stats.periodWorkedMinutes / 60;
  const earningsPerHour =
    hoursWorked > 0 ? periodProjectedEarnings / hoursWorked : null;

  const earningsReminderDays: EarningsDaySnapshot[] =
    reminderDays ??
    days.map((day) => ({
      date: day.date,
      isPast: day.isPast,
      loadCount: day.loadCount,
      dailyPayAmount: day.dailyPayAmount,
      punchStart: day.punchStart,
      punchEnd: day.punchEnd,
    }));

  const statsScope = periodMode ? "This pay period" : "This work week";

  return (
    <DailyEarningsRemindersProvider
      days={earningsReminderDays}
      periodStart={periodStart}
      periodEnd={periodEnd}
      enabled={canManage}
    >
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
                  {currentStop.seal_record?.trim() ? (
                    <>
                      <span className="text-blue-800/75 dark:text-blue-200/70">
                        {" "}
                        · Seal{" "}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {currentStop.seal_record.trim()}
                      </span>
                    </>
                  ) : null}
                  {currentStop.stop_type === "store" &&
                  currentStop.pallet_count != null ? (
                    <>
                      <span className="text-blue-800/75 dark:text-blue-200/70">
                        {" "}
                        ·{" "}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {currentStop.pallet_count} plt
                      </span>
                    </>
                  ) : null}
                  {currentStop.stop_type === "store" &&
                  currentStop.position_count != null ? (
                    <>
                      <span className="text-blue-800/75 dark:text-blue-200/70">
                        {" "}
                        ·{" "}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {currentStop.position_count} pos
                      </span>
                    </>
                  ) : null}
                </p>
              </>
            )}

            {currentStop && !allStopsDeparted ? (
              <div className="mt-2.5 space-y-2.5">
                <StopSealField
                  key={`${currentStop.id}-seal-${currentStop.seal_record ?? ""}`}
                  stopId={currentStop.id}
                  sealRecord={currentStop.seal_record}
                  canEdit={canManage}
                  variant="form"
                />
                {currentStop.stop_type === "store" ? (
                  <StopStoreCountsField
                    key={`${currentStop.id}-counts-${currentStop.pallet_count ?? ""}-${currentStop.position_count ?? ""}`}
                    stopId={currentStop.id}
                    palletCount={currentStop.pallet_count}
                    positionCount={currentStop.position_count}
                    canEdit={canManage}
                    variant="form"
                  />
                ) : null}
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

      {needsPayDate ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-50">
          <p className="font-medium">Set your pay period</p>
          <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-100/80">
            Unlock the pay-period view on Home. Pick your next deposit
            Thursday; work periods are biweekly Saturday–Friday.{" "}
            <Link
              href="/account"
              className="font-semibold underline underline-offset-2"
            >
              Open Account →
            </Link>
          </p>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3 px-0.5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {periodMode ? "Current pay period" : "Current work week"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {weekLabel}
              {depositLabel ? (
                <>
                  {" · Deposit "}
                  <span className={`font-bold ${pageTitleColorClassName}`}>
                    {depositLabel}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-border bg-muted/60 px-3 py-2 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Latest ADP
            </p>
            {latestAdp ? (
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                <MaskedMoney amount={Number(latestAdp.adp_amount)} />
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

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {periodMode
                ? "Period earnings (current calculation)"
                : "Week earnings"}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              <MaskedMoney amount={periodProjectedEarnings} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Load pay + daily pay · {statsScope}
            </p>
          </div>
          <ul className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
            <li className="min-w-0 px-3.5 py-3">
              <PeriodStat
                label="Days worked"
                value={String(daysWorked)}
                hint="Logged Work"
              />
            </li>
            <li className="min-w-0 px-3.5 py-3">
              <PeriodStat
                label="Loads"
                value={String(stats.periodLoads)}
                hint="Completed"
              />
            </li>
            <li className="min-w-0 px-3.5 py-3">
              <PeriodStat
                label="Hours"
                value={formatDurationHm(stats.periodWorkedMinutes)}
                hint="Shift punches"
              />
            </li>
            <li className="min-w-0 px-3.5 py-3">
              <PeriodStat
                label="Miles"
                value={milesLabel(stats.periodDrivenMiles)}
                hint="Driven (odometer)"
              />
            </li>
          </ul>
          {earningsPerHour != null ? (
            <div className="flex items-baseline justify-between gap-3 border-t border-border px-4 py-2.5">
              <p className="text-xs text-muted-foreground">
                Effective rate (earnings ÷ punched hours)
              </p>
              <p className="text-sm font-semibold tabular-nums text-brand">
                <MaskedMoney amount={earningsPerHour} />
                <span className="font-medium text-muted-foreground">/hr</span>
              </p>
            </div>
          ) : null}
        </div>

        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {days.map((day) => (
            <li key={day.date} className="min-w-0">
              <WorkWeekDayCard day={day} canManage={canManage} />
            </li>
          ))}
        </ul>
      </section>
    </div>
    </DailyEarningsRemindersProvider>
  );
}

function PeriodStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function WorkWeekDayCard({
  day,
  canManage,
}: {
  day: WorkWeekDaySummary;
  canManage: boolean;
}) {
  const weekday = formatCardWeekday(day.date);
  const monthDay = formatCardMonthDay(day.date);
  const hasLoads = day.loadCount > 0;
  const canAddDailyPay = !hasLoads && day.isPast && canManage;
  const canEditPunches = canManage;
  /** Past calendar days are muted; today/future keep normal (or accent) styling. */
  const isPastDay = day.isPast;

  const shellClass = isPastDay
    ? "border-border bg-zinc-200/90 dark:border-zinc-700 dark:bg-zinc-800/80"
    : day.isPayDay
      ? "border-emerald-400/80 bg-emerald-100 ring-1 ring-emerald-400/50 dark:border-emerald-600/80 dark:bg-emerald-950/55 dark:ring-emerald-500/40"
      : day.isToday
        ? "border-accent/80 bg-accent/10 ring-1 ring-accent/40"
        : day.isOffDay
          ? "border-dashed border-border bg-muted/40"
          : "border-border bg-card";

  const dateLabelClass = isPastDay
    ? "text-zinc-700 dark:text-zinc-300"
    : "text-muted-foreground";
  const metaLabelClass = isPastDay
    ? "text-zinc-600 dark:text-zinc-400"
    : "text-muted-foreground";
  const valueClass = isPastDay
    ? "font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
    : "font-semibold tabular-nums";

  return (
    <article
      className={[
        "flex h-full min-h-[7.5rem] flex-col rounded-2xl border px-3 py-3",
        shellClass,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p
            className={[
              "truncate text-sm font-semibold",
              isPastDay
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-foreground",
            ].join(" ")}
          >
            {weekday}
          </p>
          <p className={`text-xs ${dateLabelClass}`}>{monthDay}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {day.isPayDay ? (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200">
              <span aria-hidden className="text-[11px] font-bold leading-none">
                $
              </span>
              Deposit
            </span>
          ) : null}
          {day.isOffDay && !day.isPayDay ? (
            <span
              className={[
                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                isPastDay
                  ? "bg-zinc-900/10 text-zinc-700 dark:bg-zinc-100/10 dark:text-zinc-300"
                  : "bg-foreground/5 text-muted-foreground",
              ].join(" ")}
            >
              Off
            </span>
          ) : null}
          {day.isToday && !day.isPayDay ? (
            <span className="rounded-md bg-accent/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
              Today
            </span>
          ) : null}
          {day.isToday && day.isPayDay ? (
            <span className="rounded-md bg-emerald-600/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
              Today
            </span>
          ) : null}
        </div>
      </div>

      {hasLoads ? (
        <dl className="mt-auto space-y-1 pt-2.5 text-xs">
          {day.includesActivePreview ? (
            <p className="text-[10px] font-medium uppercase tracking-wide text-accent-foreground/80">
              In progress
            </p>
          ) : null}
          <div className="flex items-baseline justify-between gap-1">
            <dt className={metaLabelClass}>Loads</dt>
            <dd className={valueClass}>{day.loadCount}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <dt className={metaLabelClass}>Earn</dt>
            <dd className={`truncate ${valueClass}`}>
              <MaskedMoney amount={day.totalEarnings} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <dt className={metaLabelClass}>Driven</dt>
            <dd className={`truncate ${valueClass}`}>
              {day.totalDrivenMiles == null
                ? "—"
                : milesLabel(day.totalDrivenMiles)}
            </dd>
          </div>
        </dl>
      ) : canAddDailyPay || day.dailyPayAmount != null ? (
        <DailyPayDayEditor
          workDate={day.date}
          amount={day.dailyPayAmount}
          canEdit={canAddDailyPay}
        />
      ) : (
        <p
          className={[
            "mt-auto rounded-xl border border-dashed px-2 py-2 text-center text-xs",
            isPastDay
              ? "border-zinc-400/70 bg-zinc-100/80 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-300"
              : "border-border/80 bg-background/50 text-muted-foreground dark:bg-background/20",
          ].join(" ")}
        >
          No load logged
        </p>
      )}

      {canEditPunches || day.punchStart != null || day.punchEnd != null ? (
        <ShiftPunchDayEditor
          workDate={day.date}
          startTime={day.punchStart}
          endTime={day.punchEnd}
          canEdit={canEditPunches}
          compact
        />
      ) : null}
    </article>
  );
}
