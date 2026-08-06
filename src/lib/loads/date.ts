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

/** Pay periods end on Friday. */
export const PERIOD_END_WEEKDAY = 5;

/** @deprecated Use {@link DEPOSIT_WEEKDAY}. */
export const PAYDAY_WEEKDAY = DEPOSIT_WEEKDAY;

/**
 * Deposit (pay icon) day for a period ending on `periodEnd`.
 * Thursday of the same calendar week as the period end (Friday end → prior day).
 */
export function depositDayForPeriodEnd(periodEnd: string): string {
  const wd = weekdayOf(periodEnd);
  const back = (wd - DEPOSIT_WEEKDAY + 7) % 7;
  return addCalendarDays(periodEnd, -back);
}

/** Inclusive day count from start through end. */
export function payPeriodLengthDays(start: string, end: string): number {
  return calendarDaysBetween(end, start) + 1;
}

/**
 * True when `dateStr` falls on the deposit-day grid anchored at `anchorDepositDate`
 * (typically a Thursday), stepping by period length.
 */
export function isPayDay(
  dateStr: string,
  anchorDepositDate: string,
  periodLengthDays = 14,
): boolean {
  if (periodLengthDays < 1) return false;
  const diff = calendarDaysBetween(dateStr, anchorDepositDate);
  return ((diff % periodLengthDays) + periodLengthDays) % periodLengthDays === 0;
}

/**
 * Next deposit day on or after `today` using the period-length grid from
 * `anchorDepositDate` (Thursday deposit).
 */
export function upcomingPayDay(
  today: string,
  anchorDepositDate: string,
  periodLengthDays = 14,
): string {
  if (periodLengthDays < 1) return anchorDepositDate;
  const diff = calendarDaysBetween(today, anchorDepositDate);
  const mod = ((diff % periodLengthDays) + periodLengthDays) % periodLengthDays;
  if (mod === 0) return today;
  return addCalendarDays(today, periodLengthDays - mod);
}

export type PayPeriod = {
  start: string;
  end: string;
  /** YYYY-MM-DD dates from start through end (inclusive). */
  days: string[];
  /**
   * Deposit / pay-icon day (Thursday of the week containing period end).
   * Not the same as `end` (Friday).
   */
  payDay: string;
  /** Inclusive length in days (from seed). */
  lengthDays: number;
};

/**
 * Current pay period from a driver-seeded start/end range.
 * Advances contiguous periods of the same length until `today` falls in one
 * (or the next upcoming period if `today` is before the seed).
 * Period end is Friday; `payDay` is the Thursday deposit in that end week.
 */
export function currentPayPeriod(
  today: string,
  seedStart: string,
  seedEnd: string,
): PayPeriod {
  const lengthDays = payPeriodLengthDays(seedStart, seedEnd);
  if (lengthDays < 1) {
    const days = [seedStart];
    return {
      start: seedStart,
      end: seedEnd,
      days,
      payDay: depositDayForPeriodEnd(seedEnd),
      lengthDays: 1,
    };
  }

  const offset = calendarDaysBetween(today, seedStart);
  const periodIndex =
    offset < 0 ? 0 : Math.floor(offset / lengthDays);

  const start = addCalendarDays(seedStart, periodIndex * lengthDays);
  const end = addCalendarDays(seedEnd, periodIndex * lengthDays);
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
 * @deprecated Prefer seed start/end via {@link currentPayPeriod}.
 * Legacy: 14-day window ending on a Friday period-end anchor.
 */
export function currentPayPeriodFromAnchor(
  today: string,
  anchorPeriodEnd: string,
): PayPeriod {
  const end = upcomingPayDay(today, anchorPeriodEnd, 14);
  const start = addCalendarDays(end, -13);
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
