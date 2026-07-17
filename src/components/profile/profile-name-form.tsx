"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfileName } from "@/app/(app)/account/actions";
import {
  capitalizeFirst,
  composeFullName,
  normalizeLastInitial,
  parseFullName,
} from "@/lib/profile-name";

type Props = {
  initialName: string;
  identityLocked?: boolean;
};

export function ProfileNameForm({
  initialName,
  identityLocked = false,
}: Props) {
  const router = useRouter();
  const initial = parseFullName(initialName);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastInitial, setLastInitial] = useState(initial.lastInitial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const composed = composeFullName(firstName, lastInitial);
  const initialComposed = composeFullName(
    initial.firstName,
    initial.lastInitial,
  );
  const dirty = composed !== initialComposed;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (identityLocked) return;
    setError(null);
    setSaved(false);

    const nextFirst = capitalizeFirst(firstName);
    const nextInitial = normalizeLastInitial(lastInitial);
    setFirstName(nextFirst);
    setLastInitial(nextInitial);

    startTransition(async () => {
      const result = await updateProfileName(nextFirst, nextInitial);
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
      <div className="grid grid-cols-[1fr_4.5rem] gap-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">First name</span>
          <input
            id="first_name"
            name="first_name"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              setSaved(false);
            }}
            onBlur={() => setFirstName((v) => capitalizeFirst(v))}
            disabled={identityLocked}
            readOnly={identityLocked}
            className="min-h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-70"
            autoComplete="given-name"
            maxLength={80}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Last Initial</span>
          <input
            id="last_initial"
            name="last_initial"
            value={lastInitial}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1);
              setLastInitial(raw);
              setSaved(false);
            }}
            onBlur={() => setLastInitial((v) => normalizeLastInitial(v))}
            disabled={identityLocked}
            readOnly={identityLocked}
            className="min-h-11 rounded-lg border border-input bg-card px-3 text-center text-sm font-medium uppercase text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-70"
            autoComplete="family-name"
            maxLength={1}
            inputMode="text"
            aria-label="Last name initial"
            placeholder="—"
          />
        </label>
      </div>
      {identityLocked ? null : (
        <button
          type="submit"
          disabled={pending || !dirty}
          className="min-h-11 self-start rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save name"}
        </button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {saved ? <p className="text-xs text-brand">Saved.</p> : null}
    </form>
  );
}
