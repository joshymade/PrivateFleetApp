"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAdminContactEmail } from "@/app/(app)/profile/actions";

type Props = {
  initialEmail: string | null;
};

export function AdminContactEmailForm({ initialEmail }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = email.trim() !== (initialEmail ?? "").trim();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateAdminContactEmail(email.trim() || null);
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
        <span className="text-muted-foreground">
          Contact email for driver requests
        </span>
        <input
          type="email"
          name="admin_contact_email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSaved(false);
          }}
          autoComplete="email"
          placeholder="admin@example.com"
          className="min-h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Drivers use Contact Admin when they need another name or work-state
        change. Requests go to every admin who sets this address.
      </p>
      <button
        type="submit"
        disabled={pending || !dirty}
        className="min-h-11 self-start rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save contact email"}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {saved ? <p className="text-xs text-brand">Saved.</p> : null}
    </form>
  );
}
