"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createUser } from "@/app/(app)/admin/users/actions";
import { FLEET_REGIONS } from "@/lib/fleet-region";

const MIN_PASSWORD_LENGTH = 6;

export function AdminCreateUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [role, setRole] = useState<"driver" | "safety">("driver");
  const [region, setRegion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createUser({
        email,
        temporaryPassword,
        role,
        region: region ? Number(region) : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "User created.");
      setEmail("");
      setTemporaryPassword("");
      setRole("driver");
      setRegion("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Create user</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Creates a confirmed account with a temporary password. The user must
        change it on first login.
      </p>

      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            className="rounded-md border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Temporary password</span>
          <input
            type="text"
            name="temporaryPassword"
            autoComplete="off"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
            disabled={pending}
            className="rounded-md border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <span className="text-[11px] text-muted-foreground">
            At least {MIN_PASSWORD_LENGTH} characters. Share securely with the
            user.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Role</span>
          <select
            name="role"
            value={role}
            onChange={(e) =>
              setRole(e.target.value === "safety" ? "safety" : "driver")
            }
            disabled={pending}
            className="rounded-md border border-border bg-background px-3 py-2.5 text-base capitalize text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="driver">Driver</option>
            <option value="safety">Safety</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">
            Region{role === "safety" ? " (recommended)" : " (optional)"}
          </span>
          <select
            name="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={pending}
            className="rounded-md border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="">
              {role === "safety" ? "Assign later…" : "Driver will choose…"}
            </option>
            {FLEET_REGIONS.map((r) => (
              <option key={r} value={r}>
                Region {r}
              </option>
            ))}
          </select>
        </label>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create user"}
        </button>
      </form>
    </section>
  );
}
