import Link from "next/link";
import { redirect } from "next/navigation";
import { LoadCard } from "@/components/loads/load-card";
import { LoadListRow } from "@/components/loads/load-list-row";
import { MonthNavigator } from "@/components/loads/month-navigator";
import { pageTitleClassName } from "@/components/ui/page-title";
import { canAccessLoads, driverNeedsProfileSetup, PROFILE_SETUP_PATH } from "@/lib/auth/profile";
import {
  formatMonthLabel,
  formatWeekLabel,
  monthBounds,
  parseYearMonth,
  weekKey,
  yearMonthString,
} from "@/lib/loads/date";
import {
  getLoadsForMonth,
  getOlderLoads,
  getSessionProfile,
  type LoadWithStops,
} from "@/lib/loads/queries";

function groupByWeek(loads: LoadWithStops[]) {
  const map = new Map<string, LoadWithStops[]>();
  for (const load of loads) {
    const key = weekKey(load.load_date);
    const list = map.get(key) ?? [];
    list.push(load);
    map.set(key, list);
  }
  return [...map.entries()];
}

export default async function LoadsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseYearMonth(params.month);
  const monthKey = yearMonthString(year, month);
  const { start: monthStart } = monthBounds(year, month);

  const now = new Date();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  const { userId, profile } = await getSessionProfile();
  const role = profile?.role ?? "driver";

  if (!userId || !canAccessLoads(role)) {
    redirect("/home");
  }
  if (driverNeedsProfileSetup(role, profile)) {
    redirect(PROFILE_SETUP_PATH);
  }

  const canManage = role === "driver" || role === "admin";
  const fleet = role === "admin";
  const scope = profile
    ? { userId, role: profile.role, fleet }
    : null;

  const monthLoads = scope
    ? await getLoadsForMonth(year, month, scope)
    : [];

  const olderLoads =
    scope && isCurrentMonth
      ? await getOlderLoads(monthStart, { ...scope, limit: 50 })
      : [];

  const weekGroups = groupByWeek(monthLoads);

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 p-4 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className={pageTitleClassName}>Loads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === "admin"
              ? "Fleet loads by month and week."
              : "Your load history by month."}
          </p>
        </div>
        {canManage ? (
          <Link
            href="/loads/new"
            className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            Add load
          </Link>
        ) : null}
      </header>

      <MonthNavigator year={year} month={month} />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {isCurrentMonth ? "This month" : formatMonthLabel(year, month)}
        </h2>

        {monthLoads.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No loads in {formatMonthLabel(year, month)}.
          </p>
        ) : isCurrentMonth ? (
          <div className="space-y-3">
            {monthLoads.map((load) => (
              <LoadCard key={load.id} load={load} />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {weekGroups.map(([monday, loads]) => (
              <div key={monday}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatWeekLabel(monday)}
                </h3>
                <div className="space-y-3">
                  {loads.map((load) => (
                    <LoadCard key={load.id} load={load} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isCurrentMonth && olderLoads.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Older loads
          </h2>
          <div className="mt-2 rounded-2xl border border-border bg-background px-4">
            {olderLoads.map((load) => (
              <LoadListRow key={load.id} load={load} />
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Browse other months with the arrows above, or open{" "}
            <Link href={`/loads?month=${monthKey}`} className="underline">
              this month
            </Link>
            .
          </p>
        </section>
      ) : null}
    </main>
  );
}
