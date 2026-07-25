"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateNextPayDate } from "@/app/(app)/account/actions";
import {
  formatLongDate,
  todayDateString,
  upcomingPayDay,
  WEEKDAY_LABELS,
} from "@/lib/loads/date";

export function NextPayDateSettings({
  nextPayDate,
}: {
  nextPayDate: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(nextPayDate ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const preview = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    if (
      parsed.getFullYear() !== y ||
      parsed.getMonth() !== m - 1 ||
      parsed.getDate() !== d
    ) {
      return null;
    }
    const weekday = WEEKDAY_LABELS[parsed.getDay()]!;
    const next = upcomingPayDay(todayDateString(), value);
    return { weekday, next };
  }, [value]);

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateNextPayDate({
        nextPayDate: value.trim() ? value.trim() : null,
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
      <div>
        <p className="text-sm font-medium text-foreground">Next pay date</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter a payday (usually Thursday). We repeat that weekday every two
          weeks for your Home pay-period view. You can change this anytime.
        </p>
      </div>

      <label className="block text-sm">
        <span className="sr-only">Next pay date</span>
        <input
          type="date"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground"
        />
      </label>

      {preview ? (
        <p className="text-xs text-muted-foreground">
          Paydays every other <span className="font-medium">{preview.weekday}</span>
          . Next up:{" "}
          <span className="font-medium text-foreground">
            {formatLongDate(preview.next)}
          </span>
          .
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>
      ) : null}

      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save pay date"}
      </button>
    </div>
  );
}
