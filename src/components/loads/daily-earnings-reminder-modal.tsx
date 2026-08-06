"use client";

import { useEffect, useId } from "react";
import {
  formatMissingEarningsDates,
} from "@/lib/loads/daily-earnings-reminder";
import { formatCardMonthDay } from "@/lib/loads/date";

export type DailyEarningsReminderReason =
  | "end_punch"
  | "new_day_punch"
  | "period_missing";

export function DailyEarningsReminderModal({
  dates,
  reason,
  canEnter,
  onEnter,
  onDismiss,
}: {
  dates: string[];
  reason: DailyEarningsReminderReason;
  /** When true, primary CTA opens daily pay entry for the first date. */
  canEnter: boolean;
  onEnter: () => void;
  onDismiss: () => void;
}) {
  const titleId = useId();
  const sorted = [...dates].sort();
  const multi = sorted.length > 1;
  const label = formatMissingEarningsDates(sorted);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onDismiss]);

  const title =
    reason === "period_missing"
      ? "Daily earnings missing"
      : reason === "new_day_punch"
        ? "Enter prior-day earnings"
        : "Enter daily earnings";

  const body =
    reason === "period_missing"
      ? multi
        ? `Before this pay period closes, enter daily earnings for ${label}.`
        : `Before this pay period closes, enter daily earnings for ${label}.`
      : reason === "new_day_punch"
        ? `You started a new shift, but ${label} still has no daily earnings.`
        : multi
          ? `Add daily earnings for ${label} when you can.`
          : `Shift ended — add daily earnings for ${label} when you can.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>

        {multi ? (
          <ul className="mt-3 list-inside list-disc space-y-0.5 text-sm text-foreground">
            {sorted.map((date) => (
              <li key={date}>{formatCardMonthDay(date)}</li>
            ))}
          </ul>
        ) : null}

        {!canEnter ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Daily pay can be added on Home for past days with no loads.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {canEnter ? (
            <button
              type="button"
              onClick={onEnter}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {multi ? "Enter first day" : "Enter earnings"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground"
          >
            {canEnter ? "Not now" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}
