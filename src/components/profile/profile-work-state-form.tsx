"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfileWorkState } from "@/app/(app)/profile/actions";
import { US_STATES } from "@/lib/us-states";

type Props = {
  initialWorkState: string | null;
  identityLocked?: boolean;
};

export function ProfileWorkStateForm({
  initialWorkState,
  identityLocked = false,
}: Props) {
  const router = useRouter();
  const [workState, setWorkState] = useState(initialWorkState ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = workState !== (initialWorkState ?? "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (identityLocked) return;
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateProfileWorkState(workState || null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">What State Do You Run Out Of?</span>
        <select
          id="work_state"
          name="work_state"
          value={workState}
          onChange={(e) => {
            setWorkState(e.target.value);
            setSaved(false);
          }}
          disabled={identityLocked}
          className="min-h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <option value="">Select a state…</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {identityLocked ? null : (
        <button
          type="submit"
          disabled={pending || !dirty}
          className="min-h-11 self-start rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save work state"}
        </button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {saved ? <p className="text-xs text-brand">Saved.</p> : null}
    </form>
  );
}
