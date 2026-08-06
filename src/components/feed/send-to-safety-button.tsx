"use client";

import { useOptimistic, useState, useTransition } from "react";
import { sendToSafety } from "@/app/(app)/feed/actions";

type SendToSafetyButtonProps = {
  reportId: string;
  /** True when a safety_inbox_items row already exists for this report. */
  alreadySent: boolean;
  /** Only the reporting driver may see/use this control. */
  isOwner: boolean;
};

export function SendToSafetyButton({
  reportId,
  alreadySent,
  isOwner,
}: SendToSafetyButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useOptimistic(alreadySent);

  if (!isOwner) return null;

  function onSend() {
    if (sent || pending) return;
    setError(null);
    startTransition(async () => {
      setSent(true);
      const result = await sendToSafety(reportId);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  const disabled = sent || pending;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onSend}
        disabled={disabled}
        aria-disabled={disabled}
        className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors ${
          sent
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : pending
              ? "cursor-wait bg-red-600/70 text-white"
              : "bg-red-600 text-white hover:bg-red-700"
        }`}
      >
        {sent ? "Sent to Safety" : pending ? "Sending…" : "Send to Safety"}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
