"use client";

import { useOptimistic, useState, useTransition } from "react";
import { noticeReport } from "@/app/(app)/feed/actions";

type NoticeButtonProps = {
  reportId: string;
  noticedByMe: boolean;
  noticeCount: number;
};

type NoticeState = {
  noticed: boolean;
  count: number;
};

export function NoticeButton({
  reportId,
  noticedByMe,
  noticeCount,
}: NoticeButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(
    { noticed: noticedByMe, count: noticeCount } satisfies NoticeState,
    (current): NoticeState => ({
      noticed: true,
      count: current.count + 1,
    }),
  );

  function notice() {
    if (optimistic.noticed || pending) return;

    setError(null);
    startTransition(async () => {
      setOptimistic(null);
      const result = await noticeReport(reportId);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  const label = optimistic.noticed
    ? `Verified by You · ${optimistic.count}`
    : "👍 I Noticed This Too";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={notice}
        disabled={pending || optimistic.noticed}
        aria-pressed={optimistic.noticed}
        className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-60 ${
          optimistic.noticed
            ? "bg-emerald-700 text-white disabled:opacity-100 dark:bg-emerald-600"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {label}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
