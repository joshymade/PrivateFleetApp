"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updatePayPeriod } from "@/app/(app)/account/actions";
import {
  addCalendarDays,
  currentPayPeriod,
  DEFAULT_PAY_PERIOD_LENGTH_DAYS,
  DEPOSIT_WEEKDAY,
  depositDayForPeriodEnd,
  formatLongDate,
  formatPayPeriodLabel,
  payPeriodFromDepositDay,
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
  const initialDeposit =
    nextPayDate && isValidDateInput(nextPayDate)
      ? depositDayForPeriodEnd(nextPayDate)
      : "";

  const [deposit, setDeposit] = useState(initialDeposit);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const preview = useMemo(() => {
    if (!isValidDateInput(deposit)) return null;

    const depositWeekday = weekdayOf(deposit);
    const derived = payPeriodFromDepositDay(deposit);
    const today = todayDateString();
    const current = currentPayPeriod(today, derived.start, derived.end);
    const nextStart = addCalendarDays(
      current.start,
      DEFAULT_PAY_PERIOD_LENGTH_DAYS,
    );
    const nextEnd = addCalendarDays(current.end, DEFAULT_PAY_PERIOD_LENGTH_DAYS);
    const priorStart = addCalendarDays(
      current.start,
      -DEFAULT_PAY_PERIOD_LENGTH_DAYS,
    );
    const priorEnd = addCalendarDays(
      current.end,
      -DEFAULT_PAY_PERIOD_LENGTH_DAYS,
    );

    return {
      ...derived,
      depositWeekday,
      depositWeekdayLabel: WEEKDAY_LABELS[depositWeekday]!,
      isThursday: depositWeekday === DEPOSIT_WEEKDAY,
      current,
      nextStart,
      nextEnd,
      priorStart,
      priorEnd,
    };
  }, [deposit]);

  function onSave() {
    setError(null);
    setSaved(false);
    if (!preview || !preview.isThursday) {
      setError(
        !preview
          ? "Pick your next deposit (pay) date."
          : "Deposit day must be a Thursday.",
      );
      return;
    }
    startTransition(async () => {
      const result = await updatePayPeriod({
        payPeriodStart: preview.start,
        nextPayDate: preview.end,
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
    setDeposit("");
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
      <label className="block text-sm" htmlFor="next-deposit-date">
        <span className="mb-1 block text-xs text-muted-foreground">
          Next deposit (Thursday)
        </span>
        <input
          id="next-deposit-date"
          type="date"
          value={deposit}
          onChange={(e) => {
            setDeposit(e.target.value);
            setSaved(false);
          }}
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground"
        />
      </label>

      <p className="text-xs text-muted-foreground">
        Work periods are always biweekly ({DEFAULT_PAY_PERIOD_LENGTH_DAYS} days,
        Saturday–Friday). Prior periods line up on the same cadence from this
        deposit.
      </p>

      {preview ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Deposit falls on{" "}
            <span className="font-medium text-foreground">
              {preview.depositWeekdayLabel}
            </span>
            {preview.isThursday ? null : (
              <span className="text-destructive"> — must be Thursday</span>
            )}
            .
          </p>
          {preview.isThursday ? (
            <>
              <p>
                Seed work period (Sat–Fri):{" "}
                <span className="font-medium text-foreground">
                  {formatPayPeriodLabel(preview.start, preview.end)}
                </span>
                {" · "}
                {preview.lengthDays} days.
              </p>
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
                Previous period:{" "}
                <span className="font-medium text-foreground">
                  {formatPayPeriodLabel(preview.priorStart, preview.priorEnd)}
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
      ) : (
        <p className="text-xs text-muted-foreground">
          Pick your next deposit Thursday. We fill in the matching biweekly
          Saturday–Friday work window.
        </p>
      )}

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
        {payPeriodStart || nextPayDate || deposit ? (
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
