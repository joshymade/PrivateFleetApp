"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDamageReport } from "@/app/(app)/feed/actions";

type DeleteReportButtonProps = {
  reportId: string;
};

export function DeleteReportButton({ reportId }: DeleteReportButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (pending) return;
    const ok = window.confirm(
      "Delete this damage report permanently? Photos, notices, replies, and Safety inbox items for this report will also be removed.",
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteDamageReport(reportId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/feed");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="min-h-11 rounded-lg border border-red-700/40 px-4 text-sm font-medium text-red-700 disabled:opacity-60 dark:border-red-400/40 dark:text-red-400"
      >
        {pending ? "Deleting…" : "Delete report"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
