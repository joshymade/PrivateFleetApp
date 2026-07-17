"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";
import { archiveLoad, deleteLoad } from "@/lib/loads/actions";
import type { Load } from "@/types/database";

const ARCHIVE_HELP =
  "Archive closes this load without counting it in your stats. After you archive, a Delete button appears so you can permanently remove the load.";

/**
 * Archive closes out a load without counting toward stats.
 * Delete only appears after the load is archived.
 */
export function ArchiveDeleteLoad({
  loadId,
  status,
}: {
  loadId: string;
  status: Load["status"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canArchive =
    status === "active" || status === "pending";
  const canDelete = status === "archived";

  if (!canArchive && !canDelete) return null;

  function onArchive() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await archiveLoad(loadId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onDelete() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteLoad(loadId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // deleteLoad redirects to /loads on success
    });
  }

  return (
    <div className="space-y-2 border-t border-border pt-4">
      {canArchive ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onArchive}
            disabled={pending}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-amber-400 text-sm font-medium text-amber-950 hover:bg-amber-500 disabled:opacity-60 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
          >
            {pending ? "Archiving…" : "Archive load"}
          </button>
          <ClickableTooltip
            ariaLabel="How archive and delete work"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground"
            content={ARCHIVE_HELP}
            tooltipAlign="end"
          >
            <span className="sr-only">About archive and delete</span>
          </ClickableTooltip>
        </div>
      ) : null}

      {canDelete && !confirmDelete ? (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          Delete load
        </button>
      ) : null}

      {canDelete && confirmDelete ? (
        <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-800 dark:text-red-200">
            Permanently delete this archived load? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {pending ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={pending}
              className="min-h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
