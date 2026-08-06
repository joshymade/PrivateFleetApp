"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  anonymizeOwnDamageReports,
  resetOwnLoads,
} from "@/app/(app)/account/actions";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";

export function AccountDataResetButtons() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function runLoadsReset() {
    if (pending) return;
    const ok = window.confirm(
      "Reset loads? This permanently deletes all of your logged loads and gives you a blank slate. This cannot be undone.",
    );
    if (!ok) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await resetOwnLoads();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `Deleted ${result.deleted ?? 0} load${(result.deleted ?? 0) === 1 ? "" : "s"}.`,
      );
      router.refresh();
    });
  }

  function runDamageReset() {
    if (pending) return;
    const ok = window.confirm(
      "Reset damage reports? Your reports stay on the Feed, but your name is replaced with Anonymous Driver. You can then request deletion on each report. Continue?",
    );
    if (!ok) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await anonymizeOwnDamageReports();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `Anonymized ${result.anonymized ?? 0} report${(result.anonymized ?? 0) === 1 ? "" : "s"}.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runLoadsReset}
            disabled={pending}
            className="min-h-11 flex-1 rounded-lg border border-border px-4 text-sm font-medium text-foreground disabled:opacity-60"
          >
            {pending ? "Working…" : "Reset loads"}
          </button>
          <ClickableTooltip
            ariaLabel="Reset loads: learn more"
            content="Removes all of your logged loads and creates a blank slate. This cannot be undone."
            tooltipAlign="end"
          >
            <span className="sr-only">About Reset loads</span>
          </ClickableTooltip>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runDamageReset}
            disabled={pending}
            className="min-h-11 flex-1 rounded-lg border border-border px-4 text-sm font-medium text-foreground disabled:opacity-60"
          >
            {pending ? "Working…" : "Reset damage reports"}
          </button>
          <ClickableTooltip
            ariaLabel="Reset damage reports: learn more"
            content="All logged reports remain on the Feed, but your name as the reported driver is replaced with Anonymous Driver. You can then request Admin deletion on each report."
            tooltipAlign="end"
          >
            <span className="sr-only">About Reset damage reports</span>
          </ClickableTooltip>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
