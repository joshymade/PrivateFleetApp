/** ISO-8601 week helpers for feed filtering (UTC, Monday-start). */

export type IsoWeekParts = {
  year: number;
  week: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** ISO week year + week number for a Date (UTC calendar day). */
export function isoWeekPartsFromDate(date: Date): IsoWeekParts {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return { year, week };
}

export function isoWeekPartsFromIso(iso: string): IsoWeekParts | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return isoWeekPartsFromDate(date);
}

export function formatIsoWeekKey(parts: IsoWeekParts): string {
  return `${parts.year}-W${String(parts.week).padStart(2, "0")}`;
}

export function parseIsoWeekKey(key: string): IsoWeekParts | null {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(key.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(week)) return null;
  if (week < 1 || week > 53) return null;
  return { year, week };
}

/** Monday 00:00:00.000Z … next Monday 00:00:00.000Z (exclusive end). */
export function isoWeekRangeUtc(parts: IsoWeekParts): {
  startIso: string;
  endIso: string;
} {
  const jan4 = new Date(Date.UTC(parts.year, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - dayNum + 1);
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (parts.week - 1) * 7);
  const nextMonday = new Date(monday.getTime() + WEEK_MS);
  return {
    startIso: monday.toISOString(),
    endIso: nextMonday.toISOString(),
  };
}

export function shiftIsoWeek(parts: IsoWeekParts, deltaWeeks: number): IsoWeekParts {
  const { startIso } = isoWeekRangeUtc(parts);
  const shifted = new Date(new Date(startIso).getTime() + deltaWeeks * WEEK_MS);
  return isoWeekPartsFromDate(shifted);
}

export function currentIsoWeek(now = new Date()): IsoWeekParts {
  return isoWeekPartsFromDate(now);
}
