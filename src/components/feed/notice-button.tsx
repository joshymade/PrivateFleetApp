"use client";

import { useEffect, useState, useTransition } from "react";
import { noticeReport } from "@/app/(app)/feed/actions";

type NoticeButtonProps = {
  reportId: string;
  noticedByMe: boolean;
  noticeCount: number;
};

export function NoticeButton({
  reportId,
  noticedByMe,
  noticeCount,
}: NoticeButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localNoticed, setLocalNoticed] = useState(noticedByMe);
  const [localCount, setLocalCount] = useState(noticeCount);

  useEffect(() => {
    setLocalNoticed(noticedByMe);
    setLocalCount(noticeCount);
  }, [noticedByMe, noticeCount]);

  function notice() {
    if (localNoticed || pending) return;

    setError(null);
    setLocalNoticed(true);
    setLocalCount((c) => c + 1);

    startTransition(async () => {
      const result = await noticeReport(reportId);
      if (!result.ok) {
        setLocalNoticed(false);
        setLocalCount((c) => Math.max(0, c - 1));
        setError(result.error);
      }
    });
  }

  const label = localNoticed
    ? `Verified by You · ${localCount}`
    : "👍 I Noticed This Too";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={notice}
        disabled={pending || localNoticed}
        aria-pressed={localNoticed}
        className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-60 ${
          localNoticed
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
