"use client";

import { useState, useTransition } from "react";
import { updateInboxStatus } from "@/app/(app)/safety/actions";
import type { SafetyInboxStatus } from "@/types/database";

type InboxStatusActionsProps = {
  itemId: string;
  status: SafetyInboxStatus;
};

export function InboxStatusActions({
  itemId,
  status,
}: InboxStatusActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(status);

  function setStatus(next: "reviewed" | "dismissed") {
    if (localStatus === next) return;
    setError(null);
    const prev = localStatus;
    setLocalStatus(next);

    startTransition(async () => {
      const result = await updateInboxStatus(itemId, next);
      if (!result.ok) {
        setLocalStatus(prev);
        setError(result.error);
      }
    });
  }

  if (localStatus !== "pending") {
    return (
      <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
        Status:{" "}
        <span className="font-medium capitalize">{localStatus}</span>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStatus("reviewed")}
          disabled={pending}
          className="min-h-11 flex-1 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          Mark reviewed
        </button>
        <button
          type="button"
          onClick={() => setStatus("dismissed")}
          disabled={pending}
          className="min-h-11 flex-1 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground disabled:opacity-60"
        >
          Dismiss
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
