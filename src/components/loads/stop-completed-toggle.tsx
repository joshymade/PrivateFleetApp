"use client";

import { useOptimistic, useTransition } from "react";
import { toggleStopCompleted } from "@/lib/loads/actions";

type Variant = "page" | "panel";

/**
 * Checkbox + strikethrough for a load stop.
 * Checking/unchecking recomputes loads.trailer_number from the last checked
 * stop that has a trailer.
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

  function onCheckedChange(next: boolean) {
    if (!canToggle || pending) return;
    startTransition(async () => {
      setOptimisticCompleted(next);
      await toggleStopCompleted(stopId, next);
      // On failure, useOptimistic reverts to `completed` when the transition ends.
    });
  }

  const struck = optimisticCompleted;
  const checkboxClass =
    variant === "panel"
      ? "size-5 shrink-0 rounded border-border bg-background text-accent focus-visible:ring-accent/60 dark:border-white/40 dark:bg-black/20"
      : "size-5 shrink-0 rounded border-border bg-background text-brand focus-visible:ring-brand/40";

  const textClass = struck
    ? variant === "panel"
      ? "line-through text-muted-foreground [&_*]:text-muted-foreground dark:text-white/50 dark:[&_*]:text-white/50"
      : "line-through text-muted-foreground [&_*]:text-muted-foreground"
    : "";

  return (
    <label
      className={`flex min-h-11 items-start gap-3 ${
        canToggle ? "cursor-pointer" : "cursor-default"
      } ${pending ? "opacity-70" : ""}`}
    >
      <input
        type="checkbox"
        className={`${checkboxClass} mt-0.5`}
        checked={struck}
        disabled={!canToggle || pending}
        onChange={(e) => onCheckedChange(e.target.checked)}
        aria-label={struck ? "Mark stop not done" : "Mark stop done"}
      />
      <span className={`min-w-0 flex-1 ${textClass}`}>{children}</span>
    </label>
  );
}
