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

/**
 * True when `dateStr` falls on the biweekly payday grid anchored at `anchorPayDate`.
 * Example anchors: 2026-06-04, 2026-06-18, 2026-07-02, 2026-07-16, 2026-07-30 (Thursdays).
 */
export function isPayDay(dateStr: string, anchorPayDate: string): boolean {
  const diff = calendarDaysBetween(dateStr, anchorPayDate);
  return ((diff % 14) + 14) % 14 === 0;
}

/**
 * Next payday on or after `today` using the biweekly grid from `anchorPayDate`.
 */
export function upcomingPayDay(today: string, anchorPayDate: string): string {
  const diff = calendarDaysBetween(today, anchorPayDate);
  const mod = ((diff % 14) + 14) % 14;
  if (mod === 0) return today;
  return addCalendarDays(today, 14 - mod);
}

export type PayPeriod = {
  start: string;
  end: string;
  /** 14 YYYY-MM-DD dates from start through payday (inclusive). */
  days: string[];
  payDay: string;
};

/**
 * Current pay period: 14 days ending on the upcoming payday (inclusive).
 * e.g. payday Jul 30 → Jul 17 … Jul 30.
 */
export function currentPayPeriod(
  today: string,
  anchorPayDate: string,
): PayPeriod {
  const payDay = upcomingPayDay(today, anchorPayDate);
  const start = addCalendarDays(payDay, -13);
  const days = Array.from({ length: 14 }, (_, i) => addCalendarDays(start, i));
  return { start, end: payDay, days, payDay };
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
