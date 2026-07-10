"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeLoad } from "@/lib/loads/actions";

export function CompleteLoadButton({ loadId }: { loadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (pending) return;
    const ok = window.confirm(
      "Mark this load complete? All stops will be checked and the current trailer cleared.",
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await completeLoad(loadId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Completing…" : "Complete load"}
      </button>
      {error ? (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
