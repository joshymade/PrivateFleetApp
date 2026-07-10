import Link from "next/link";
import { DayOfWeekCard } from "@/components/loads/day-of-week-card";
import { SafetyHomeStatsGrid } from "@/components/safety/safety-home-stats";
import {
  canAccessAdminUsers,
  canAccessSafetyInbox,
  driverNeedsProfileSetup,
  getSessionProfile,
} from "@/lib/auth/profile";
import { todayDateString } from "@/lib/loads/date";
import { getTodayLoad } from "@/lib/loads/queries";
import { createClient } from "@/lib/supabase/server";
import type { SafetyHomeStats } from "@/types/database";

function parseSafetyHomeStats(data: unknown): SafetyHomeStats | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const n = (key: string) => {
    const v = row[key];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  return {
    total_reports: n("total_reports"),
    pending_review: n("pending_review"),
    reports_24h: n("reports_24h"),
    reports_30d: n("reports_30d"),
  };
}

export default async function HomePage() {
  const session = await getSessionProfile();
  const userId = session?.userId ?? null;
  const profile = session?.profile ?? null;
  const today = todayDateString();
  const role = session?.role ?? profile?.role ?? "driver";
  const profileIncomplete = driverNeedsProfileSetup(role, profile);
  const canManage =
    (role === "driver" || role === "admin") && !profileIncomplete;
  const isSafety = role === "safety";

  const load =
    userId && profile && !isSafety
      ? await getTodayLoad({
          userId,
          role: profile.role,
          fleet: profile.role === "admin",
        })
      : null;

  let pendingInbox = 0;
  let safetyStats: SafetyHomeStats | null = null;

  if (userId && isSafety) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("safety_home_stats");
    safetyStats = parseSafetyHomeStats(data);
  } else if (userId && canAccessSafetyInbox(role)) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("safety_inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingInbox = count ?? 0;
  }

  if (isSafety) {
    return (
      <main className="mx-auto w-full max-w-lg space-y-5 p-4 pb-8 pt-3">
        {!userId ? (
          <div className="rounded-2xl border border-accent/50 bg-accent/15 px-4 py-3 text-sm text-foreground">
            Sign in to see Safety overview.{" "}
            <Link href="/login" className="font-medium text-brand underline">
              Sign in
            </Link>
          </div>
        ) : (
          <SafetyHomeStatsGrid stats={safetyStats} />
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 p-4 pb-8 pt-3">
      {!userId ? (
        <div className="rounded-2xl border border-accent/50 bg-accent/15 px-4 py-3 text-sm text-foreground">
          Sign in to see today&apos;s load.{" "}
          <Link href="/login" className="font-medium text-brand underline">
            Sign in
          </Link>
        </div>
      ) : null}

      <DayOfWeekCard
        today={today}
        load={load}
        canManage={Boolean(userId && canManage)}
        role={role}
      />

      {role === "admin" ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            Fleet oversight
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse all loads and assign from the Loads tab.
          </p>
          <div className="mt-3 flex flex-col gap-2 text-sm font-medium">
            <Link
              href="/loads"
              className="underline-offset-2 hover:underline"
            >
              Open fleet loads →
            </Link>
            {canAccessAdminUsers(role) ? (
              <Link
                href="/admin/users"
                className="underline-offset-2 hover:underline"
              >
                Manage users →
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {role === "admin" ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            Inbox & review
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {pendingInbox > 0
              ? `${pendingInbox} pending report${pendingInbox === 1 ? "" : "s"}.`
              : "No pending reports. Review damage on Feed anytime."}
          </p>
          <div className="mt-3 flex flex-col gap-2 text-sm font-medium">
            <Link href="/feed" className="underline-offset-2 hover:underline">
              Open fleet Feed →
            </Link>
            {canAccessSafetyInbox(role) ? (
              <Link
                href="/safety/inbox"
                className="underline-offset-2 hover:underline"
              >
                Safety inbox
                {pendingInbox > 0 ? ` (${pendingInbox})` : ""} →
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
