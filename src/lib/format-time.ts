const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function formatAbsolute(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Feed / reply / notification timestamps:
 * - within the last 7 days → relative “time ago”
 * - older (or future) → locale date + time
 */
export function formatFeedTimestamp(iso: string, now = new Date()): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;

    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0 || diffMs >= SEVEN_DAYS_MS) {
      return formatAbsolute(date);
    }

    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    const seconds = Math.round(diffMs / 1000);
    if (Math.abs(seconds) < 60) return rtf.format(-seconds, "second");

    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");

    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");

    const days = Math.round(hours / 24);
    return rtf.format(-days, "day");
  } catch {
    return iso;
  }
}
