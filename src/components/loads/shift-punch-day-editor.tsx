"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteShiftPunch,
  upsertShiftPunch,
} from "@/lib/loads/shift-punches";
import {
  formatDurationHm,
  parseTimeToMinutes,
  shiftDurationMinutes,
  toHtmlTime,
} from "@/lib/loads/shift-time";

export function ShiftPunchDayEditor({
  workDate,
  startTime,
  endTime,
  canEdit,
  compact = false,
}: {
  workDate: string;
  startTime: string | null;
  endTime: string | null;
  canEdit: boolean;
  /** Tighter layout for crowded day cards. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(toHtmlTime(startTime));
  const [end, setEnd] = useState(toHtmlTime(endTime));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const durationMins = shiftDurationMinutes(startTime, endTime);
  const hasPunch = startTime != null || endTime != null;

  if (!canEdit && !hasPunch) {
    return null;
  }

  if (!open) {
    if (!canEdit) {
      return (
        <div
          className={
            compact
              ? "mt-1.5 border-t border-border/60 pt-1.5 text-[11px]"
              : "mt-auto rounded-xl border border-dashed border-border/80 bg-background/50 px-2 py-2 text-center text-xs dark:bg-background/20"
          }
        >
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Hours
          </span>
          <span className="mt-0.5 block font-semibold tabular-nums text-foreground">
            {durationMins != null ? formatDurationHm(durationMins) : "—"}
          </span>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          setStart(toHtmlTime(startTime));
          setEnd(toHtmlTime(endTime));
          setError(null);
          setOpen(true);
        }}
        className={
          compact
            ? "mt-1.5 w-full border-t border-border/60 pt-1.5 text-left transition-colors hover:opacity-90"
            : "mt-auto w-full rounded-xl border border-dashed border-border/80 bg-background/50 px-2 py-2 text-center text-xs transition-colors hover:border-accent/60 hover:bg-accent/10 dark:bg-background/20"
        }
      >
        {hasPunch ? (
          <>
            <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Hours
            </span>
            <span className="mt-0.5 block text-xs font-semibold tabular-nums text-foreground">
              {durationMins != null ? formatDurationHm(durationMins) : "Partial"}
            </span>
            <span className="mt-0.5 block text-[10px] tabular-nums text-muted-foreground">
              {toHtmlTime(startTime) || "—"} → {toHtmlTime(endTime) || "—"}
            </span>
          </>
        ) : (
          <span
            className={
              compact
                ? "text-[11px] font-medium text-brand"
                : "font-medium text-brand"
            }
          >
            Add punches
          </span>
        )}
      </button>
    );
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertShiftPunch({
        workDate,
        startTime: start || null,
        endTime: end || null,
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
      const result = await deleteShiftPunch({ workDate });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStart("");
      setEnd("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSave}
      className="mt-1.5 space-y-1.5 rounded-xl border border-border bg-background/80 px-2 py-2 dark:bg-background/30"
      onClick={(e) => e.stopPropagation()}
    >
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Start
        </span>
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="mt-0.5 min-h-9 w-full rounded-lg border border-border bg-background px-2 text-sm tabular-nums"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          End
        </span>
        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="mt-0.5 min-h-9 w-full rounded-lg border border-border bg-background px-2 text-sm tabular-nums"
        />
      </label>
      {(() => {
        const liveMins = shiftDurationMinutes(start, end);
        if (liveMins == null) return null;
        const startM = parseTimeToMinutes(start);
        const endM = parseTimeToMinutes(end);
        const overnight =
          startM != null && endM != null && endM < startM;
        return (
          <p className="text-[11px] tabular-nums text-muted-foreground">
            Total {formatDurationHm(liveMins)}
            {overnight ? " (overnight)" : ""}
          </p>
        );
      })()}
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
      {hasPunch ? (
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
