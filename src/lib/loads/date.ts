/** Local calendar helpers for load_date (Postgres `date`, no timezone shift). */

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayDateString(): string {
  return toDateString(new Date());
}

/** Starting odometer required for same-day loads; optional when logging past loads. */
export function isStartingMileageRequired(loadDate: string): boolean {
  return loadDate === todayDateString();
}

/**
 * Ending odometer required when starting was recorded, or when the load is today.
 * Past loads with no starting mileage may complete without ending mileage.
 */
export function isEndingMileageRequired(
  loadDate: string,
  startingMileage: number | null | undefined,
): boolean {
  return startingMileage != null || isStartingMileageRequired(loadDate);
}

export function parseYearMonth(value: string | null | undefined): {
  year: number;
  month: number;
} {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function yearMonthString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthBounds(year: number, month: number): {
  start: string;
  end: string;
} {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function shiftYearMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function formatDayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
  });
}

export function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** ISO-8601 week number (week starts Monday; week 1 has the year's first Thursday). */
export function isoWeekNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
}

/** Compact label, e.g. `Wed · Jul 8` (CSS `uppercase` → `WED · JUL 8`). */
export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const monthDay = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${weekday} · ${monthDay}`;
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** ISO Monday-based week key (legacy grouping). Prefer workWeekStart for drivers. */
export function weekKey(dateStr: string): string {
  return workWeekStart(dateStr, 1);
}

/**
 * Start date of the work week containing `dateStr`.
 * weekStartDay: 0=Sun … 6=Sat (default Friday = 5).
 */
export function workWeekStart(dateStr: string, weekStartDay = 5): string {
  const startDay = ((weekStartDay % 7) + 7) % 7;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = (day - startDay + 7) % 7;
  const start = new Date(y, m - 1, d - diff);
  return toDateString(start);
}

/** Seven YYYY-MM-DD dates starting at weekStartStr. */
export function workWeekDays(weekStartStr: string): string[] {
  const [y, m, d] = weekStartStr.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) =>
    toDateString(new Date(y, m - 1, d + i)),
  );
}

export function formatWeekLabel(weekStartStr: string): string {
  const [y, m, d] = weekStartStr.split("-").map(Number);
  const startDate = new Date(y, m - 1, d);
  const endDate = new Date(y, m - 1, d + 6);
  const start = startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const end = endDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `Week of ${start} – ${end}`;
}

export function formatCardWeekday(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
  });
}

export function formatCardMonthDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Driven miles from odometer pair; null if incomplete. */
export function drivenMiles(
  starting: number | null | undefined,
  ending: number | null | undefined,
): number | null {
  if (starting == null || ending == null) return null;
  const value = Number(ending) - Number(starting);
  return Number.isFinite(value) ? value : null;
}

/** Days after completion during which pay_amount may still be edited. */
export const PAY_AMOUNT_EDIT_DAYS = 20;

/**
 * Pay amount is editable when the load was completed within the last
 * {@link PAY_AMOUNT_EDIT_DAYS} days. Falls back to `updatedAt` when
 * `completedAt` is missing (legacy rows before the column existed).
 */
export function isPayAmountEditable(
  completedAt: string | null | undefined,
  updatedAt?: string | null,
  now = new Date(),
): boolean {
  const stamp = completedAt ?? updatedAt ?? null;
  if (!stamp) return false;
  const completed = new Date(stamp);
  if (Number.isNaN(completed.getTime())) return false;
  const windowMs = PAY_AMOUNT_EDIT_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - completed.getTime() <= windowMs;
}

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Calendar-day difference: `a` − `b` in whole days (local dates). */
export function calendarDaysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aUtc = Date.UTC(ay, am - 1, ad);
  const bUtc = Date.UTC(by, bm - 1, bd);
  return Math.round((aUtc - bUtc) / 86_400_000);
}

export function addCalendarDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toDateString(new Date(y, m - 1, d + delta));
}

/** Sunday=0 … Saturday=6 for a local YYYY-MM-DD calendar date. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Checks are deposited on Thursday (week-view pay icon). */
export const DEPOSIT_WEEKDAY = 4;

/** Pay periods start on Saturday. */
export const PERIOD_START_WEEKDAY = 6;

/** Pay periods end on Friday. */
export const PERIOD_END_WEEKDAY = 5;

/** Default biweekly work window (Sat→Fri inclusive). */
export const DEFAULT_PAY_PERIOD_LENGTH_DAYS = 14;

/**
 * Days from Friday period end to Thursday deposit in the following week.
 * Example: period ends Fri Jul 24 → deposit Thu Jul 30 (+6).
 */
export const PERIOD_END_TO_DEPOSIT_DAYS = 6;

/** @deprecated Use {@link DEPOSIT_WEEKDAY}. */
export const PAYDAY_WEEKDAY = DEPOSIT_WEEKDAY;

/**
 * Deposit day for a period ending on `periodEnd`.
 * Always the Thursday after that Friday (period end + 6), not the Thursday
 * inside the ending week.
 */
export function depositDayForPeriodEnd(periodEnd: string): string {
  return addCalendarDays(periodEnd, PERIOD_END_TO_DEPOSIT_DAYS);
}

/**
 * Friday period end implied by a Thursday deposit (deposit − 6).
 */
export function periodEndForDepositDay(depositDate: string): string {
  return addCalendarDays(depositDate, -PERIOD_END_TO_DEPOSIT_DAYS);
}

/**
 * Inclusive Sat→Fri work window ending on the Friday before `depositDate`.
 * Work periods are always biweekly (14 days inclusive).
 */
export function payPeriodFromDepositDay(
  depositDate: string,
  /** @deprecated Always biweekly; ignored. */
  _lengthDays: number = DEFAULT_PAY_PERIOD_LENGTH_DAYS,
): { start: string; end: string; lengthDays: number; payDay: string } {
  const end = periodEndForDepositDay(depositDate);
  const lengthDays = DEFAULT_PAY_PERIOD_LENGTH_DAYS;
  const start = addCalendarDays(end, -(lengthDays - 1));
  return {
    start,
    end,
    lengthDays,
    payDay: depositDate,
  };
}

/** Inclusive day count from start through end. */
export function payPeriodLengthDays(start: string, end: string): number {
  return calendarDaysBetween(end, start) + 1;
}

/**
 * True when `dateStr` falls on the deposit-day grid anchored at `anchorDepositDate`
 * (typically a Thursday), stepping by the biweekly period length.
 */
export function isPayDay(
  dateStr: string,
  anchorDepositDate: string,
  /** @deprecated Always biweekly; ignored. */
  _periodLengthDays: number = DEFAULT_PAY_PERIOD_LENGTH_DAYS,
): boolean {
  const step = DEFAULT_PAY_PERIOD_LENGTH_DAYS;
  const diff = calendarDaysBetween(dateStr, anchorDepositDate);
  return ((diff % step) + step) % step === 0;
}

/**
 * Next deposit day on or after `today` using the biweekly grid from
 * `anchorDepositDate` (Thursday deposit).
 */
export function upcomingPayDay(
  today: string,
  anchorDepositDate: string,
  /** @deprecated Always biweekly; ignored. */
  _periodLengthDays: number = DEFAULT_PAY_PERIOD_LENGTH_DAYS,
): string {
  const step = DEFAULT_PAY_PERIOD_LENGTH_DAYS;
  const diff = calendarDaysBetween(today, anchorDepositDate);
  const mod = ((diff % step) + step) % step;
  if (mod === 0) return today;
  return addCalendarDays(today, step - mod);
}

export type PayPeriod = {
  start: string;
  end: string;
  /** YYYY-MM-DD dates from start through end (inclusive). */
  days: string[];
  /**
   * Deposit day for this period (Thursday after Friday end, typically +6).
   * Falls outside the work window.
   */
  payDay: string;
  /** Inclusive length in days (always {@link DEFAULT_PAY_PERIOD_LENGTH_DAYS}). */
  lengthDays: number;
};

/**
 * Build a biweekly Sat→Fri {@link PayPeriod} from its Saturday start.
 */
export function payPeriodFromStart(start: string): PayPeriod {
  const lengthDays = DEFAULT_PAY_PERIOD_LENGTH_DAYS;
  const end = addCalendarDays(start, lengthDays - 1);
  const days = Array.from({ length: lengthDays }, (_, i) =>
    addCalendarDays(start, i),
  );
  return {
    start,
    end,
    days,
    payDay: depositDayForPeriodEnd(end),
    lengthDays,
  };
}

/**
 * Shift a pay period by `periods` steps on the biweekly grid
 * (negative = prior periods, positive = later).
 */
export function shiftPayPeriod(period: PayPeriod, periods: number): PayPeriod {
  return payPeriodFromStart(
    addCalendarDays(period.start, periods * DEFAULT_PAY_PERIOD_LENGTH_DAYS),
  );
}

/**
 * Prior biweekly Sat→Fri periods walking backward from the period that
 * contains `today` (excludes the current period). Used for ADP entry.
 */
export function previousPayPeriods(
  today: string,
  seedStart: string,
  seedEnd: string,
  count: number,
): PayPeriod[] {
  if (count <= 0) return [];
  const current = currentPayPeriod(today, seedStart, seedEnd);
  return Array.from({ length: count }, (_, i) =>
    shiftPayPeriod(current, -(i + 1)),
  );
}

/**
 * Pay period containing `dateStr` on the biweekly Sat→Fri grid seeded by a
 * driver Sat→Fri range (from next-deposit selection).
 *
 * Anchors on the seed Friday (`seedEnd`) so deposit day stays aligned, then
 * walks forward/backward in 14-day steps so historical punches, daily pay, and
 * loads land in the matching prior window — not a mismatched week.
 * `payDay` is the Thursday deposit after that Friday end (+6).
 */
export function currentPayPeriod(
  dateStr: string,
  _seedStart: string,
  seedEnd: string,
): PayPeriod {
  const lengthDays = DEFAULT_PAY_PERIOD_LENGTH_DAYS;
  // Normalize to biweekly ending on the seed Friday (deposit − 6). Legacy
  // 7/21/28 seeds keep deposit alignment by expanding/contracting from end.
  const anchorStart = addCalendarDays(seedEnd, -(lengthDays - 1));

  const offset = calendarDaysBetween(dateStr, anchorStart);
  const periodIndex = Math.floor(offset / lengthDays);

  return payPeriodFromStart(
    addCalendarDays(anchorStart, periodIndex * lengthDays),
  );
}

/**
 * Deposit that lands inside a Sat-start period (paycheck for the prior period):
 * Thursday of the period's first week = start + 5.
 */
export function depositDayInPeriod(periodStart: string): string {
  return addCalendarDays(periodStart, 5);
}

/**
 * @deprecated Prefer seed start/end via {@link currentPayPeriod}.
 * Legacy: 14-day Sat→Fri window from a Friday period-end anchor.
 */
export function currentPayPeriodFromAnchor(
  today: string,
  anchorPeriodEnd: string,
): PayPeriod {
  const end = upcomingPayDay(today, anchorPeriodEnd);
  const start = addCalendarDays(end, -(DEFAULT_PAY_PERIOD_LENGTH_DAYS - 1));
  return currentPayPeriod(today, start, end);
}

export function formatPayPeriodLabel(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  const startLabel = startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endLabel = endDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}
