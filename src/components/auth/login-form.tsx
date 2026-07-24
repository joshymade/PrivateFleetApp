"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getPostAuthLandingPath } from "@/lib/auth/landing";
import { driverNeedsProfileSetup } from "@/lib/auth/profile-complete";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

export function LoginForm({
  initialError,
}: {
  initialError?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    initialError === "disabled"
      ? "This account has been disabled. Contact Admin if you need access restored."
      : null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setPending(false);
      const msg = signInError.message.toLowerCase();
      if (msg.includes("banned") || msg.includes("disabled")) {
        setError(
          "This account has been disabled. Contact Admin if you need access restored.",
        );
      } else {
        setError(signInError.message);
      }
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setPending(false);
      router.replace("/home");
      router.refresh();
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, work_state, disabled_at, must_change_password")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.disabled_at) {
      await supabase.auth.signOut();
      setPending(false);
      setError(
        "This account has been disabled. Contact Admin if you need access restored.",
      );
      return;
    }

    const role = (profile?.role as UserRole | undefined) ?? "driver";
    const needsSetup = driverNeedsProfileSetup(role, profile);
    const landing = await getPostAuthLandingPath(supabase, {
      userId,
      needsSetup,
      mustChangePassword: Boolean(profile?.must_change_password),
    });

    setPending(false);
    router.replace(landing.href);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-input bg-card px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-input bg-card px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Need an account?{" "}
        <Link href="/signup" className="font-medium text-foreground underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
