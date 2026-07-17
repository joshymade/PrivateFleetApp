"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  capitalizeFirst,
  composeFullName,
  normalizeLastInitial,
} from "@/lib/profile-name";
import { createClient } from "@/lib/supabase/client";

function signupErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("driver_id already in use") || lower.includes("duplicate")) {
    return "That Driver ID is already registered. Use a different company Driver ID.";
  }
  if (lower.includes("database error creating new user")) {
    return "Could not create your profile. Check Driver ID and try again, or ask an admin to clear a half-created account.";
  }
  return message;
}

export function SignupForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [driverId, setDriverId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);

    const trimmedDriverId = driverId.trim();
    if (!trimmedDriverId) {
      setPending(false);
      setError("Driver ID is required.");
      return;
    }

    const nextFirst = capitalizeFirst(firstName);
    const nextInitial = normalizeLastInitial(lastInitial);
    setFirstName(nextFirst);
    setLastInitial(nextInitial);
    const fullName = composeFullName(nextFirst, nextInitial);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          driver_id: trimmedDriverId,
          full_name: fullName || undefined,
        },
      },
    });

    setPending(false);

    if (signUpError) {
      setError(signupErrorMessage(signUpError.message));
      return;
    }

    // Email confirmations may leave session null until the user verifies.
    if (!data.session) {
      setInfo(
        "Account created. Check your email to confirm, then sign in.",
      );
      return;
    }

    // New drivers still need work_state (and may have skipped name).
    router.replace("/account?setup=1");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_4.5rem] gap-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">First name</span>
          <input
            type="text"
            name="first_name"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onBlur={() => setFirstName((v) => capitalizeFirst(v))}
            maxLength={80}
            className="rounded-md border border-input bg-card px-3 py-2.5 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Last</span>
          <input
            type="text"
            name="last_initial"
            autoComplete="family-name"
            value={lastInitial}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1);
              setLastInitial(raw);
            }}
            onBlur={() => setLastInitial((v) => normalizeLastInitial(v))}
            maxLength={1}
            inputMode="text"
            aria-label="Last name initial"
            placeholder="—"
            className="rounded-md border border-input bg-card px-3 py-2.5 text-center text-base font-medium uppercase text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Driver ID</span>
        <input
          type="text"
          name="driver_id"
          required
          minLength={1}
          autoComplete="off"
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
          className="rounded-md border border-input bg-card px-3 py-2.5 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <span className="text-xs text-muted-foreground">
          Unique company Driver ID (required). Must not already be in use.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-input bg-card px-3 py-2.5 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-input bg-card px-3 py-2.5 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {info ? (
        <p className="text-sm text-foreground" role="status">
          {info}{" "}
          <Link href="/login" className="font-medium underline">
            Sign in
          </Link>
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
