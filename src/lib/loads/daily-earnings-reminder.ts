import { formatCardMonthDay } from "@/lib/loads/date";

/** Snapshot used to decide whether a day still needs manual daily earnings. */
export type EarningsDaySnapshot = {
  date: string;
  /** Past calendar day (before today). */
  isPast: boolean;
  loadCount: number;
  dailyPayAmount: number | null;
  punchStart: string | null;
  punchEnd: string | null;
};

export function hasCompletePunch(
  day: Pick<EarningsDaySnapshot, "punchStart" | "punchEnd">,
): boolean {
  return day.punchStart != null && day.punchEnd != null;
}

/**
 * Days where daily pay is expected but missing: past, no loads, complete
 * punch pair, no daily_pay entry.
 */
export function datesMissingDailyEarnings(
  days: EarningsDaySnapshot[],
): string[] {
  return days
    .filter(
      (day) =>
        day.isPast &&
        day.loadCount === 0 &&
        hasCompletePunch(day) &&
        day.dailyPayAmount == null,
    )
    .map((day) => day.date)
    .sort();
}

/**
 * Most recent prior calendar day with a completed punch pair (start + end).
 */
export function findPreviousCompletedWorkDay(
  days: EarningsDaySnapshot[],
  beforeDate: string,
): EarningsDaySnapshot | null {
  let best: EarningsDaySnapshot | null = null;
  for (const day of days) {
    if (day.date >= beforeDate) continue;
    if (!hasCompletePunch(day)) continue;
    if (best == null || day.date > best.date) best = day;
  }
  return best;
}

/** True when that prior work day still needs manual daily earnings. */
export function previousWorkDayNeedsDailyEarnings(
  days: EarningsDaySnapshot[],
  beforeDate: string,
): EarningsDaySnapshot | null {
  const prev = findPreviousCompletedWorkDay(days, beforeDate);
  if (!prev) return null;
  if (prev.loadCount > 0) return null;
  if (prev.dailyPayAmount != null) return null;
  return prev;
}

export function formatMissingEarningsDates(dates: string[]): string {
  if (dates.length === 0) return "";
  if (dates.length === 1) return formatCardMonthDay(dates[0]!);
  if (dates.length === 2) {
    return `${formatCardMonthDay(dates[0]!)} and ${formatCardMonthDay(dates[1]!)}`;
  }
  const head = dates
    .slice(0, -1)
    .map((d) => formatCardMonthDay(d))
    .join(", ");
  return `${head}, and ${formatCardMonthDay(dates[dates.length - 1]!)}`;
}

export function periodReminderSessionKey(
  periodEnd: string | null,
  missingDates: string[],
): string {
  const end = periodEnd ?? "week";
  return `pf:daily-earnings-reminder:${end}:${missingDates.join(",")}`;
}

/** Survives `router.refresh()` after punch save so the modal still appears. */
export const PENDING_EARNINGS_REMINDER_KEY =
  "pf:pending-daily-earnings-reminder";

export type PendingEarningsReminder = {
  dates: string[];
  reason: "end_punch" | "new_day_punch" | "period_missing";
};

export function writePendingEarningsReminder(
  reminder: PendingEarningsReminder,
): void {
  try {
    sessionStorage.setItem(
      PENDING_EARNINGS_REMINDER_KEY,
      JSON.stringify(reminder),
    );
  } catch {
    // ignore
  }
}

export function consumePendingEarningsReminder(): PendingEarningsReminder | null {
  try {
    const raw = sessionStorage.getItem(PENDING_EARNINGS_REMINDER_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_EARNINGS_REMINDER_KEY);
    const parsed = JSON.parse(raw) as PendingEarningsReminder;
    if (
      !parsed ||
      !Array.isArray(parsed.dates) ||
      parsed.dates.length === 0 ||
      typeof parsed.reason !== "string"
    ) {
      return null;
    }
    return {
      dates: parsed.dates.filter(Boolean).sort(),
      reason: parsed.reason,
    };
  } catch {
    return null;
  }
}
