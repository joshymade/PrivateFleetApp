"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  requestReportDeletion,
  untagDamageReport,
} from "@/app/(app)/feed/actions";

type ReportPrivacyActionsProps = {
  reportId: string;
  canUntag: boolean;
  canRequestDeletion: boolean;
  hasPendingDeletionRequest: boolean;
};

export function ReportPrivacyActions({
  reportId,
  canUntag,
  canRequestDeletion,
  hasPendingDeletionRequest,
}: ReportPrivacyActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canUntag && !canRequestDeletion && !hasPendingDeletionRequest) {
    return null;
  }

  function onUntag() {
    if (pending) return;
    const ok = window.confirm(
      "Untag yourself from this report? It will show as reported by Anonymous Driver. The report stays on the Feed. You can then request Admin to delete it.",
    );
    if (!ok) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await untagDamageReport(reportId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("You are untagged. You can now request deletion.");
      router.refresh();
    });
  }

  function onRequestDeletion() {
    if (pending) return;
    const note = window.prompt(
      "Optional message for Admin about why this report should be deleted:",
      "",
    );
    if (note === null) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await requestReportDeletion(reportId, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Deletion requested. Admin will review it.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {canUntag ? (
        <button
          type="button"
          onClick={onUntag}
          disabled={pending}
          className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium text-foreground disabled:opacity-60"
        >
          {pending ? "Working…" : "Make Anonymous"}
        </button>
      ) : null}

      {canRequestDeletion ? (
        <button
          type="button"
          onClick={onRequestDeletion}
          disabled={pending}
          className="min-h-11 rounded-lg border border-amber-700/40 px-4 text-sm font-medium text-amber-800 disabled:opacity-60 dark:border-amber-400/40 dark:text-amber-300"
        >
          {pending ? "Working…" : "Request deletion"}
        </button>
      ) : null}

      {hasPendingDeletionRequest ? (
        <p className="text-xs text-muted-foreground" role="status">
          Deletion requested — waiting for Admin review.
        </p>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
