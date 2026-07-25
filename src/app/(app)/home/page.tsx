import Link from "next/link";
import type { ReactNode } from "react";
import {
  summarizeWorkWeekDays,
  summarizeWorkWeekStats,
  WorkWeekHome,
} from "@/components/loads/work-week-home";
import { SafetyHomeStatsGrid } from "@/components/safety/safety-home-stats";
import {
  canAccessAdminUsers,
  canAccessSafetyInbox,
  driverNeedsProfileSetup,
  getSessionProfile,
} from "@/lib/auth/profile";
import {
  currentPayPeriod,
  formatCardMonthDay,
  formatPayPeriodLabel,
  formatWeekLabel,
  todayDateString,
  workWeekDays,
  workWeekStart,
} from "@/lib/loads/date";
import {
  getActiveLoadForDriver,
  getDailyPayForWorkWeek,
  getLatestAdp,
  getLoadsForWorkWeek,
  getMonthDailyPayTotal,
  getMonthLoadStats,
} from "@/lib/loads/queries";
import { createClient } from "@/lib/supabase/server";
import type { SafetyHomeStats } from "@/types/database";

function parseSafetyHomeStats(data: unknown): SafetyHomeStats | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const n = (key: string) => {
    const v = row[key];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  const regionRaw = row.region;
  const region =
    typeof regionRaw === "number" &&
    Number.isInteger(regionRaw) &&
    regionRaw >= 1 &&
    regionRaw <= 6
      ? regionRaw
      : null;
  return {
    region,
    region_total: n("region_total"),
    region_pending: n("region_pending"),
    region_reports_24h: n("region_reports_24h"),
    region_reports_30d: n("region_reports_30d"),
    fleet_total: n("fleet_total"),
    fleet_pending: n("fleet_pending"),
    fleet_reports_24h: n("fleet_reports_24h"),
    fleet_reports_30d: n("fleet_reports_30d"),
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
  const canManage = role === "driver" && !profileIncomplete;
  const isSafety = role === "safety";
  const isDriver = role === "driver";

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

  // Drivers only: private pay-period / work-week analytics (owner-scoped).
  let workWeekSection: ReactNode = null;
  if (userId && isDriver && profile) {
    const weekStartDay = profile.week_start_day ?? 5;
    const offDays = profile.off_days ?? [];
    const nextPayDate = profile.next_pay_date ?? null;
    const periodMode = Boolean(nextPayDate);

    let rangeStart: string;
    let rangeEnd: string;
    let days: string[];
    let payDayDate: string | null = null;
    let rangeLabel: string;

    if (nextPayDate) {
      const period = currentPayPeriod(today, nextPayDate);
      rangeStart = period.start;
      rangeEnd = period.end;
      days = period.days;
      payDayDate = period.payDay;
      rangeLabel = `${formatPayPeriodLabel(period.start, period.end)} · Pay day ${formatCardMonthDay(period.payDay)}`;
    } else {
      rangeStart = workWeekStart(today, weekStartDay);
      days = workWeekDays(rangeStart);
      rangeEnd = days[6]!;
      rangeLabel = formatWeekLabel(rangeStart);
    }

    const [todayYear, todayMonth] = today.split("-").map(Number);

    const [periodLoads, monthStats, latestAdp, activeLoad, periodDailyPay, monthDailyPay] =
      await Promise.all([
        getLoadsForWorkWeek(userId, rangeStart, rangeEnd),
        getMonthLoadStats(userId, todayYear!, todayMonth!),
        getLatestAdp(userId),
        getActiveLoadForDriver(userId),
        getDailyPayForWorkWeek(userId, rangeStart, rangeEnd),
        getMonthDailyPayTotal(userId, todayYear!, todayMonth!),
      ]);

    const dailyPayByDate = new Map(
      periodDailyPay.map((entry) => [entry.work_date, Number(entry.amount)]),
    );

    const daySummaries = summarizeWorkWeekDays(
      days,
      periodLoads,
      offDays,
      today,
      activeLoad,
      dailyPayByDate,
      payDayDate,
    );
    const periodStats = summarizeWorkWeekStats(periodLoads, periodDailyPay);

    workWeekSection = (
      <WorkWeekHome
        weekLabel={rangeLabel}
        days={daySummaries}
        stats={{
          periodLoads: periodStats.loadCount,
          periodEarnings: periodStats.earnings,
          periodDrivenMiles: periodStats.drivenMiles,
          monthLoads: monthStats.loadCount,
          monthEarnings: monthStats.earnings + monthDailyPay,
          monthDrivenMiles: monthStats.drivenMiles,
        }}
        latestAdp={latestAdp}
        activeLoad={activeLoad}
        currentTruckNumber={profile.current_truck_number}
        canManage={canManage}
        periodMode={periodMode}
        needsPayDate={!nextPayDate}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 p-4 pb-8 pt-3">
      {!userId ? (
        <div className="rounded-2xl border border-accent/50 bg-accent/15 px-4 py-3 text-sm text-foreground">
          Sign in to see your work week.{" "}
          <Link href="/login" className="font-medium text-brand underline">
            Sign in
          </Link>
        </div>
      ) : null}

      {workWeekSection}

      {role === "admin" ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            Fleet oversight
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Driver load details are private to each driver. Use Feed and users
            for fleet oversight.
          </p>
          <div className="mt-3 flex flex-col gap-2 text-sm font-medium">
            <Link href="/feed" className="underline-offset-2 hover:underline">
              Open fleet Feed →
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
