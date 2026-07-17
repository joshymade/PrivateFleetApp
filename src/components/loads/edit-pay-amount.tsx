"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateLoadPayAmount } from "@/lib/loads/actions";

export function EditPayAmount({
  loadId,
  currentAmount,
}: {
  loadId: string;
  currentAmount: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    currentAmount != null ? String(currentAmount) : "",
  );
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await updateLoadPayAmount(loadId, Number(value));
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs font-medium text-brand underline-offset-2 hover:underline"
      >
        {currentAmount != null ? "Edit pay" : "Add pay amount"}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 space-y-2">
      <input
        required
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-base"
        aria-label="Pay amount"
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 flex-1 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
            setValue(currentAmount != null ? String(currentAmount) : "");
          }}
          className="min-h-10 rounded-xl px-3 text-sm font-medium text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
