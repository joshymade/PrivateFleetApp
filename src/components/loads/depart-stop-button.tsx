"use client";

import { Loader2, Navigation } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleStopCompleted } from "@/lib/loads/actions";

export function DepartStopButton({ stopId }: { stopId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDepart() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await toggleStopCompleted(stopId, true);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onDepart}
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-50 disabled:cursor-wait disabled:opacity-65 dark:bg-blue-400 dark:text-blue-950 dark:hover:bg-blue-300 dark:focus-visible:ring-offset-blue-950"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Navigation className="size-4" aria-hidden />
        )}
        {pending ? "Departing…" : "Depart"}
      </button>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
