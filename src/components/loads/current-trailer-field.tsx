/**
 * Stylized current-trailer readout for Home (and similar surfaces).
 * Reflects loads.trailer_number (last checked stop with a trailer; null when none).
 */
export function CurrentTrailerField({
  trailerNumber,
  variant = "panel",
}: {
  trailerNumber: string | null;
  /** `panel` = on Home day card; `page` = light/dark page surface. */
  variant?: "panel" | "page";
}) {
  const display = trailerNumber?.trim() || "—";

  if (variant === "panel") {
    return (
      <div className="rounded-2xl border border-accent/50 bg-white/80 px-4 py-3 ring-1 ring-border dark:bg-black/20 dark:ring-white/10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          Current trailer
        </p>
        <p className="mt-1 font-mono text-3xl font-semibold tracking-tight text-foreground tabular-nums dark:text-white">
          {display}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 dark:border-brand/40 dark:bg-brand-soft/40">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
        Current trailer
      </p>
      <p className="mt-1 font-mono text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {display}
      </p>
    </div>
  );
}
