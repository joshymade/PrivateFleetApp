"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteDailyPay,
  upsertDailyPay,
} from "@/lib/loads/daily-pay";

function currency(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function DailyPayDayEditor({
  workDate,
  amount,
  canEdit,
}: {
  workDate: string;
  amount: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    amount != null ? String(amount) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) {
    return (
      <p className="mt-auto rounded-xl border border-dashed border-border/80 bg-background/50 px-2 py-2 text-center text-xs text-muted-foreground dark:bg-background/20">
        No load logged
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(amount != null ? String(amount) : "");
          setError(null);
          setOpen(true);
        }}
        className="mt-auto w-full rounded-xl border border-dashed border-border/80 bg-background/50 px-2 py-2 text-center text-xs transition-colors hover:border-accent/60 hover:bg-accent/10 dark:bg-background/20"
      >
        {amount != null ? (
          <>
            <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Daily pay
            </span>
            <span className="mt-0.5 block font-semibold tabular-nums text-foreground">
              {currency(amount)}
            </span>
          </>
        ) : (
          <span className="font-medium text-brand">Add daily pay</span>
        )}
      </button>
    );
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertDailyPay({
        workDate,
        amount: Number(value),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function onClear() {
    setError(null);
    startTransition(async () => {
      const result = await deleteDailyPay({ workDate });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setValue("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSave}
      className="mt-auto space-y-1.5 rounded-xl border border-border bg-background/80 px-2 py-2 dark:bg-background/30"
    >
      <label className="block">
        <span className="sr-only">Daily pay amount</span>
        <input
          inputMode="decimal"
          required
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
          className="min-h-9 w-full rounded-lg border border-border bg-background px-2 text-sm tabular-nums"
        />
      </label>
      {error ? (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={pending}
          className="min-h-8 flex-1 rounded-lg bg-primary px-2 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="min-h-8 rounded-lg border border-border px-2 text-[11px] font-medium text-muted-foreground disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      {amount != null ? (
        <button
          type="button"
          disabled={pending}
          onClick={onClear}
          className="w-full text-[11px] font-medium text-destructive disabled:opacity-60"
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}
