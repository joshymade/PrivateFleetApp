"use client";

import { Box, Check, Loader2, MoveRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { updateStopStoreCounts } from "@/lib/loads/actions";

type Variant = "page" | "panel" | "form";

/**
 * Optional pallet + position counts for store stops.
 * Primary save via check button; blur / Enter as backup.
 */
export function StopStoreCountsField({
  stopId,
  palletCount,
  positionCount,
  canEdit,
  variant = "page",
  onSaved,
}: {
  stopId: string;
  palletCount: number | null;
  positionCount: number | null;
  canEdit: boolean;
  variant?: Variant;
  onSaved?: (next: {
    palletCount: number | null;
    positionCount: number | null;
  }) => void;
}) {
  const router = useRouter();
  const [pallets, setPallets] = useState(
    palletCount != null ? String(palletCount) : "",
  );
  const [positions, setPositions] = useState(
    positionCount != null ? String(positionCount) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevPallets = palletCount != null ? String(palletCount) : "";
  const prevPositions = positionCount != null ? String(positionCount) : "";
  const dirty =
    pallets.trim() !== prevPallets || positions.trim() !== prevPositions;
  const canSave = canEdit && dirty && !pending;

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  function flashSaved() {
    setJustSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), 1400);
  }

  function parseCount(raw: string): number | null | "invalid" {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 0) return "invalid";
    return n;
  }

  function save() {
    if (!canEdit || pending) return;
    const nextPallets = parseCount(pallets);
    const nextPositions = parseCount(positions);
    if (nextPallets === "invalid") {
      setError("Pallet count must be a whole number ≥ 0.");
      return;
    }
    if (nextPositions === "invalid") {
      setError("Position count must be a whole number ≥ 0.");
      return;
    }
    if (
      nextPallets === palletCount &&
      nextPositions === positionCount &&
      pallets.trim() === prevPallets &&
      positions.trim() === prevPositions
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateStopStoreCounts(
        stopId,
        nextPallets,
        nextPositions,
      );
      if (result.error) {
        setError(result.error);
        setPallets(prevPallets);
        setPositions(prevPositions);
        return;
      }
      onSaved?.({ palletCount: nextPallets, positionCount: nextPositions });
      flashSaved();
      router.refresh();
    });
  }

  if (!canEdit) {
    if (palletCount == null && positionCount == null) return null;
    return (
      <p
        className={
          variant === "panel"
            ? "flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-8 text-xs text-muted-foreground dark:text-white/60"
            : variant === "form"
              ? "flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground"
              : "flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-8 text-xs text-muted-foreground"
        }
      >
        {palletCount != null ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Box className="size-3.5 shrink-0" aria-hidden />
            {palletCount}
            <span className="sr-only">pallets</span>
          </span>
        ) : null}
        {positionCount != null ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <MoveRight className="size-3.5 shrink-0" aria-hidden />
            {positionCount}
            <span className="sr-only">positions</span>
          </span>
        ) : null}
      </p>
    );
  }

  const isForm = variant === "form";
  const isPanel = variant === "panel";

  const inputClass = isPanel
    ? "min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/90 px-3 text-base text-foreground tabular-nums outline-none placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/40 disabled:opacity-60 dark:border-white/30 dark:bg-black/20 dark:text-white"
    : "min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-base text-foreground tabular-nums outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60";

  const saveButtonClass = [
    "inline-flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-40",
    justSaved
      ? "border-accent/50 bg-accent/15 text-accent"
      : canSave
        ? "border-brand/40 bg-brand/10 text-brand hover:bg-brand/15 active:bg-brand/20 dark:border-brand/50 dark:bg-brand/20 dark:text-brand dark:hover:bg-brand/25"
        : "border-border bg-muted/50 text-muted-foreground",
  ].join(" ");

  return (
    <div className={isForm ? "block text-sm" : "pl-8 pt-1.5"}>
      {isForm ? (
        <span className="mb-1 block text-sm font-medium text-foreground">
          Store counts{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </span>
      ) : null}

      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-1.5">
          <Box
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="sr-only">Pallet count</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={pallets}
            disabled={pending}
            placeholder="Pallets"
            aria-label="Pallet count"
            onChange={(e) => {
              setJustSaved(false);
              setPallets(e.target.value);
            }}
            onBlur={() => save()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            className={inputClass}
          />
        </label>
        <label className="flex min-w-0 flex-1 items-center gap-1.5">
          <MoveRight
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="sr-only">Position count</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={positions}
            disabled={pending}
            placeholder="Positions"
            aria-label="Position count"
            onChange={(e) => {
              setJustSaved(false);
              setPositions(e.target.value);
            }}
            onBlur={() => save()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            className={inputClass}
          />
        </label>
        <button
          type="button"
          disabled={!canSave}
          aria-label={
            pending
              ? "Saving store counts"
              : justSaved
                ? "Store counts saved"
                : "Save store counts"
          }
          title={justSaved ? "Saved" : "Save store counts"}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onClick={() => save()}
          className={saveButtonClass}
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Check className="size-5" strokeWidth={2.5} aria-hidden />
          )}
        </button>
      </div>

      {isForm ? (
        <span className="mt-1 block text-xs text-muted-foreground">
          Tap ✓ to save.
        </span>
      ) : null}

      {error ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : justSaved && !isForm ? (
        <p className="mt-1 text-xs font-medium text-accent" role="status">
          Saved
        </p>
      ) : null}
    </div>
  );
}
