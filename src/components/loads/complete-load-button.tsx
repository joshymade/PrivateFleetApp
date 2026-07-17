"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeLoad } from "@/lib/loads/actions";

export function CompleteLoadButton({
  loadId,
  startingMileage,
}: {
  loadId: string;
  startingMileage: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [endingMileage, setEndingMileage] = useState("");
  const [payAmount, setPayAmount] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    const end = Number(endingMileage);
    const pay = Number(payAmount);
    if (!Number.isFinite(end)) {
      setError("Ending mileage is required.");
      return;
    }
    if (startingMileage != null && end < Number(startingMileage)) {
      setError("Ending mileage must be greater than or equal to starting mileage.");
      return;
    }
    if (!Number.isFinite(pay) || pay < 0) {
      setError("Pay amount is required.");
      return;
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
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-60"
        >
          Complete load
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
    >
      <p className="text-sm font-semibold text-foreground">Complete load</p>
      <p className="text-xs text-muted-foreground">
        Enter ending mileage and pay amount. All stops will be checked and the
        current trailer cleared.
        {startingMileage != null
          ? ` Starting mileage: ${startingMileage}.`
          : ""}
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Ending mileage</span>
        <input
          required
          inputMode="decimal"
          value={endingMileage}
          onChange={(e) => setEndingMileage(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Pay amount ($)</span>
        <input
          required
          inputMode="decimal"
          value={payAmount}
          onChange={(e) => setPayAmount(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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
          className="min-h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
