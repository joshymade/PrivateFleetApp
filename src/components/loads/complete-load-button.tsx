"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeLoad } from "@/lib/loads/actions";
import { isEndingMileageRequired } from "@/lib/loads/date";

export function CompleteLoadButton({
  loadId,
  loadDate,
  startingMileage,
  variant = "default",
}: {
  loadId: string;
  loadDate: string;
  startingMileage: number | null;
  /** `home` = yellow accent on blue Active Load card. */
  variant?: "default" | "home";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [endingMileage, setEndingMileage] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const endingRequired = isEndingMileageRequired(loadDate, startingMileage);
  const isHome = variant === "home";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    const endRaw = endingMileage.trim();
    const end = endRaw ? Number(endRaw) : null;
    const payRaw = payAmount.trim();
    let pay: number | null = null;
    if (endingRequired && (end == null || !Number.isFinite(end))) {
      setError("Ending mileage is required.");
      return;
    }
    if (endRaw && !Number.isFinite(end)) {
      setError("Ending mileage must be a number.");
      return;
    }
    if (startingMileage != null && end != null && end < Number(startingMileage)) {
      setError("Ending mileage must be greater than or equal to starting mileage.");
      return;
    }
    if (payRaw) {
      pay = Number(payRaw);
      if (!Number.isFinite(pay) || pay < 0) {
        setError("Enter a valid pay amount.");
        return;
      }
    }
    startTransition(async () => {
      const result = await completeLoad(loadId, {
        endingMileage: end,
        payAmount: pay,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          className={
            isHome
              ? "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-50 disabled:opacity-60 dark:focus-visible:ring-offset-blue-950"
              : "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          }
        >
          Complete load
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={
        isHome
          ? "space-y-3 rounded-2xl border border-blue-200 bg-white/80 p-4 dark:border-blue-800/60 dark:bg-blue-950/50"
          : "space-y-3 rounded-2xl border border-border bg-card p-4"
      }
    >
      <p
        className={
          isHome
            ? "text-sm font-semibold text-blue-950 dark:text-blue-50"
            : "text-sm font-semibold text-foreground"
        }
      >
        Complete load
      </p>
      <p
        className={
          isHome
            ? "text-xs text-blue-800/75 dark:text-blue-200/70"
            : "text-xs text-muted-foreground"
        }
      >
        Enter ending mileage. Pay amount is optional and can be added later.
        All stops will be checked and the current trailer cleared.
        {startingMileage != null
          ? ` Starting mileage: ${startingMileage}.`
          : ""}
      </p>
      <label className="block text-sm">
        <span
          className={
            isHome
              ? "mb-1 block font-medium text-blue-950 dark:text-blue-50"
              : "mb-1 block font-medium"
          }
        >
          Ending mileage
        </span>
        <input
          required={endingRequired}
          inputMode="decimal"
          value={endingMileage}
          onChange={(e) => setEndingMileage(e.target.value)}
          className={
            isHome
              ? "min-h-11 w-full rounded-xl border border-blue-200 bg-background px-3 text-base dark:border-blue-800/60"
              : "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
          }
        />
        {!endingRequired ? (
          <span
            className={
              isHome
                ? "mt-1 block text-xs text-blue-700/70 dark:text-blue-200/65"
                : "mt-1 block text-xs text-muted-foreground"
            }
          >
            Optional when starting mileage was not recorded
          </span>
        ) : null}
      </label>
      <label className="block text-sm">
        <span
          className={
            isHome
              ? "mb-1 block font-medium text-blue-950 dark:text-blue-50"
              : "mb-1 block font-medium"
          }
        >
          Pay amount ($)
        </span>
        <input
          inputMode="decimal"
          value={payAmount}
          onChange={(e) => setPayAmount(e.target.value)}
          className={
            isHome
              ? "min-h-11 w-full rounded-xl border border-blue-200 bg-background px-3 text-base dark:border-blue-800/60"
              : "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
          }
        />
        <span
          className={
            isHome
              ? "mt-1 block text-xs text-blue-700/70 dark:text-blue-200/65"
              : "mt-1 block text-xs text-muted-foreground"
          }
        >
          Optional — you can add or edit pay for 20 days after completion
        </span>
      </label>
      {error ? (
        <p
          className={
            isHome
              ? "text-sm text-red-700 dark:text-red-300"
              : "text-sm text-red-600 dark:text-red-400"
          }
        >
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Completing…" : "Confirm complete"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={
            isHome
              ? "min-h-11 rounded-xl px-4 text-sm font-medium text-blue-800/80 dark:text-blue-200/75"
              : "min-h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground"
          }
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
