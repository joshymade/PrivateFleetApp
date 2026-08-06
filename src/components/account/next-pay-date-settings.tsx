"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updatePayPeriod } from "@/app/(app)/account/actions";
import {
  addCalendarDays,
  currentPayPeriod,
  formatLongDate,
  formatPayPeriodLabel,
  PERIOD_END_WEEKDAY,
  payPeriodLengthDays,
  todayDateString,
  weekdayOf,
  WEEKDAY_LABELS,
} from "@/lib/loads/date";

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() === m - 1 &&
    parsed.getDate() === d
  );
}

export function PayPeriodSettings({
  payPeriodStart,
  nextPayDate,
}: {
  payPeriodStart: string | null;
  nextPayDate: string | null;
}) {
  const router = useRouter();
  const [start, setStart] = useState(payPeriodStart ?? "");
  const [end, setEnd] = useState(nextPayDate ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const preview = useMemo(() => {
    if (!isValidDateInput(start) || !isValidDateInput(end)) return null;
    if (end < start) return null;

    const lengthDays = payPeriodLengthDays(start, end);
    const endWeekday = weekdayOf(end);
    const today = todayDateString();
    const current = currentPayPeriod(today, start, end);
    const nextStart = addCalendarDays(current.start, lengthDays);
    const nextEnd = addCalendarDays(current.end, lengthDays);

    return {
      lengthDays,
      endWeekday,
      endWeekdayLabel: WEEKDAY_LABELS[endWeekday]!,
      isFriday: endWeekday === PERIOD_END_WEEKDAY,
      lengthOk: lengthDays >= 7 && lengthDays <= 28 && lengthDays % 7 === 0,
      current,
      nextStart,
      nextEnd,
    };
  }, [start, end]);

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePayPeriod({
        payPeriodStart: start.trim() ? start.trim() : null,
        nextPayDate: end.trim() ? end.trim() : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function onClear() {
    setStart("");
    setEnd("");
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePayPeriod({
        payPeriodStart: null,
        nextPayDate: null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm" htmlFor="pay-period-start">
          <span className="mb-1 block text-xs text-muted-foreground">
            Period start
          </span>
          <input
            id="pay-period-start"
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setSaved(false);
            }}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground"
          />
        </label>
        <label className="block text-sm" htmlFor="pay-period-end">
          <span className="mb-1 block text-xs text-muted-foreground">
            Period end (Friday)
          </span>
          <input
            id="pay-period-end"
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setSaved(false);
            }}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground"
          />
        </label>
      </div>

      {preview ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Length:{" "}
            <span className="font-medium text-foreground">
              {preview.lengthDays} days
            </span>
            {preview.lengthOk ? null : (
              <span className="text-destructive">
                {" "}
                — use 7, 14, 21, or 28 days
              </span>
            )}
            . End falls on{" "}
            <span className="font-medium text-foreground">
              {preview.endWeekdayLabel}
            </span>
            {preview.isFriday ? null : (
              <span className="text-destructive"> — must be Friday</span>
            )}
            .
          </p>
          {preview.isFriday && preview.lengthOk ? (
            <>
              <p>
                Current period:{" "}
                <span className="font-medium text-foreground">
                  {formatPayPeriodLabel(
                    preview.current.start,
                    preview.current.end,
                  )}
                </span>
                . Deposit{" "}
                <span className="font-medium text-foreground">
                  {formatLongDate(preview.current.payDay)}
                </span>
                .
              </p>
              <p>
                Next period auto-advances to{" "}
                <span className="font-medium text-foreground">
                  {formatPayPeriodLabel(preview.nextStart, preview.nextEnd)}
                </span>
                .
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="min-h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save pay period"}
        </button>
        {payPeriodStart || nextPayDate || start || end ? (
          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground disabled:opacity-60"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
