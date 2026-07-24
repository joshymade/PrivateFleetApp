"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfileRegion } from "@/app/(app)/account/actions";
import { ContactAdminButton } from "@/components/profile/contact-admin-button";
import { FLEET_REGIONS } from "@/lib/fleet-region";

type Props = {
  initialRegion: number | null;
  regionLocked: boolean;
  defaultEmail: string;
  driverId: string | null;
};

export function ProfileRegionForm({
  initialRegion,
  regionLocked,
  defaultEmail,
  driverId,
}: Props) {
  const router = useRouter();
  const [region, setRegion] = useState(
    initialRegion != null ? String(initialRegion) : "",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = region !== (initialRegion != null ? String(initialRegion) : "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (regionLocked) return;
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const parsed = region ? Number(region) : null;
      const result = await updateProfileRegion(parsed);
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
        <span className="text-muted-foreground">Region</span>
        <select
          id="region"
          name="region"
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setSaved(false);
          }}
          disabled={regionLocked}
          className="min-h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <option value="">Select region…</option>
          {FLEET_REGIONS.map((r) => (
            <option key={r} value={r}>
              Region {r}
            </option>
          ))}
        </select>
      </label>

      {regionLocked ? (
        <p className="text-xs text-muted-foreground" role="status">
          Region is locked. Contact Admin to request a change.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Choose once. After you save, only Admin can change it.
        </p>
      )}

      {regionLocked ? (
        <ContactAdminButton
          defaultEmail={defaultEmail}
          driverId={driverId}
        />
      ) : (
        <button
          type="submit"
          disabled={pending || !dirty || !region}
          className="min-h-11 self-start rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save region"}
        </button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {saved ? <p className="text-xs text-brand">Saved.</p> : null}
    </form>
  );
}
