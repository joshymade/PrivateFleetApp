"use client";

import { useOptimistic, useTransition } from "react";
import { toggleStopCompleted } from "@/lib/loads/actions";

type Variant = "page" | "panel";

/**
 * Checkbox for marking a load stop Departed.
 * Once departed, the checkbox stays checked and cannot be unchecked.
 * Departing recomputes loads.trailer_number from the last departed stop
 * that has a trailer.
 */
export function StopCompletedToggle({
  stopId,
  completed,
  canToggle,
  variant = "page",
  children,
}: {
  stopId: string;
  completed: boolean;
  canToggle: boolean;
  variant?: Variant;
  children: React.ReactNode;
}) {
  const [optimisticCompleted, setOptimisticCompleted] =
    useOptimistic(completed);
  const [pending, startTransition] = useTransition();

  const departed = optimisticCompleted;
  // Once departed, never allow uncheck; only allow checking when not yet departed.
  const allowCheck = canToggle && !departed;

  function onCheckedChange(next: boolean) {
    if (!allowCheck || pending || !next) return;
    startTransition(async () => {
      setOptimisticCompleted(true);
      await toggleStopCompleted(stopId, true);
      // On failure, useOptimistic reverts to `completed` when the transition ends.
    });
  }

  const checkboxClass =
    variant === "panel"
      ? "size-5 shrink-0 rounded border-border bg-background text-accent focus-visible:ring-accent/60 dark:border-white/40 dark:bg-black/20"
      : "size-5 shrink-0 rounded border-border bg-background text-brand focus-visible:ring-brand/40";

  const textClass = departed
    ? variant === "panel"
      ? "line-through text-muted-foreground [&_*]:text-muted-foreground dark:text-white/50 dark:[&_*]:text-white/50"
      : "line-through text-muted-foreground [&_*]:text-muted-foreground"
    : "";

  return (
    <label
      className={`flex min-h-11 items-start gap-3 ${
        allowCheck ? "cursor-pointer" : "cursor-default"
      } ${pending ? "opacity-70" : ""}`}
    >
      <input
        type="checkbox"
        className={`${checkboxClass} mt-0.5`}
        checked={departed}
        disabled={!allowCheck || pending}
        onChange={(e) => onCheckedChange(e.target.checked)}
        aria-label={departed ? "Departed" : "Mark stop Departed"}
      />
      <span className="min-w-0 flex-1">
        <span className={textClass}>{children}</span>
        {departed ? (
          <span
            className={
              variant === "panel"
                ? "mt-0.5 block text-xs font-medium text-muted-foreground dark:text-white/50"
                : "mt-0.5 block text-xs font-medium text-muted-foreground"
            }
          >
            Departed
          </span>
        ) : null}
      </span>
    </label>
  );
}
