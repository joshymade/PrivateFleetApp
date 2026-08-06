/** Parse `HH:MM` / `HH:MM:SS` to minutes from midnight. */
export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Normalize DB/HTML time to `HH:MM` for `<input type="time">`. */
export function toHtmlTime(value: string | null | undefined): string {
  const mins = parseTimeToMinutes(value);
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Duration in minutes when both times are set.
 * If end < start, treat as crossing midnight (+24h).
 * Equal start/end → 0.
 */
export function shiftDurationMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): number | null {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return null;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/** Format minutes as `H:MM` (e.g. `8:05`, `0:45`). */
export function formatDurationHm(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Persist HTML `HH:MM` as Postgres `time` (`HH:MM:SS`). */
export function toPostgresTime(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const mins = parseTimeToMinutes(trimmed);
  if (mins == null) return null;
  return `${toHtmlTime(trimmed)}:00`;
}
