"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { updateStopSealRecord } from "@/lib/loads/actions";

type Variant = "page" | "panel" | "form";

/**
 * Seal record for a stop — primary save via check button; blur / Enter as backup.
 * Optional field; empty clears the saved value.
 */
export function StopSealField({
  stopId,
  sealRecord,
  canEdit,
  variant = "page",
  onSaved,
}: {
  stopId: string;
  sealRecord: string | null;
  canEdit: boolean;
  variant?: Variant;
  /** Sync parent draft after a successful save (e.g. LoadForm). */
  onSaved?: (sealRecord: string | null) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(sealRecord ?? "");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = value.trim();
  const prev = (sealRecord ?? "").trim();
  const dirty = trimmed !== prev;
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

  function save(next: string) {
    if (!canEdit || pending) return;
    const nextTrimmed = next.trim();
    const previous = (sealRecord ?? "").trim();
    if (nextTrimmed === previous) return;

    setError(null);
    startTransition(async () => {
      const result = await updateStopSealRecord(stopId, nextTrimmed || null);
      if (result.error) {
        setError(result.error);
        setValue(sealRecord ?? "");
        return;
      }
      const saved = nextTrimmed || null;
      onSaved?.(saved);
      flashSaved();
      router.refresh();
    });
  }

  if (!canEdit) {
    if (!sealRecord?.trim()) return null;
    return (
      <p
        className={
          variant === "panel"
            ? "pl-8 text-xs text-muted-foreground dark:text-white/60"
            : variant === "form"
              ? "text-sm text-muted-foreground"
              : "pl-8 text-xs text-muted-foreground"
        }
      >
        Seal {sealRecord}
      </p>
    );
  }

  const isForm = variant === "form";
  const isPanel = variant === "panel";

  const labelClass = isForm
    ? "mb-1 block text-sm font-medium text-foreground"
    : isPanel
      ? "shrink-0 text-xs font-medium text-muted-foreground dark:text-white/70"
      : "shrink-0 text-xs font-medium text-muted-foreground";

  const inputClass = isPanel
    ? "min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/90 px-3.5 text-base text-foreground tabular-nums outline-none placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/40 disabled:opacity-60 dark:border-white/30 dark:bg-black/20 dark:text-white"
    : "min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 text-base text-foreground tabular-nums outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60";

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

  const field = (
    <>
      {isForm ? (
        <span className={labelClass}>
          Seal record{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </span>
      ) : null}

      <div className={isForm ? "flex items-center gap-2" : "flex min-h-11 items-center gap-2"}>
        {!isForm ? <span className={labelClass}>Seal</span> : null}
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          value={value}
          disabled={pending}
          placeholder={isForm ? "Seal #" : "Seal record"}
          aria-label="Stop seal record"
          onChange={(e) => {
            setJustSaved(false);
            setValue(e.target.value);
          }}
          onBlur={() => save(value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save(value);
            }
          }}
          className={inputClass}
        />
        <button
          type="button"
          disabled={!canSave}
          aria-label={
            pending
              ? "Saving seal record"
              : justSaved
                ? "Seal record saved"
                : "Save seal record"
          }
          title={justSaved ? "Saved" : "Save seal record"}
          onMouseDown={(e) => {
            // Keep focus so blur does not race the check-button save.
            e.preventDefault();
          }}
          onClick={() => save(value)}
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
    </>
  );

  if (isForm) {
    return <div className="block text-sm">{field}</div>;
  }

  return <div className="pl-8 pt-1.5">{field}</div>;
}
