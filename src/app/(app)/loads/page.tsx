import Link from "next/link";
import { redirect } from "next/navigation";
import { LoadCard } from "@/components/loads/load-card";
import { LoadListRow } from "@/components/loads/load-list-row";
import { LoadsListExpand } from "@/components/loads/loads-list-expand";
import { LoadsMonthCharts } from "@/components/loads/loads-month-charts";
import { LoadsMonthTotals } from "@/components/loads/loads-month-totals";
import { MonthNavigator } from "@/components/loads/month-navigator";
import { pageTitleClassName, sectionHeadingColorClassName } from "@/components/ui/page-title";
import {
  canAccessLoads,
  driverNeedsProfileSetup,
  PROFILE_SETUP_PATH,
} from "@/lib/auth/profile";
import {
  formatMonthLabel,
  formatWeekLabel,
  monthBounds,
  parseYearMonth,
  workWeekStart,
} from "@/lib/loads/date";
import { loadsHref } from "@/lib/loads/href";
import {
  buildMonthChartDays,
  getLatestAdp,
  getLoadsForMonth,
  getMonthWorkedMinutes,
  getOlderLoads,
  getSessionProfile,
  summarizeMonthLoads,
  type LoadWithStops,
} from "@/lib/loads/queries";

/** Recent preview size for the current calendar month (before expand). */
const PREVIEW_LIMIT = 5;

function groupByWorkWeek(loads: LoadWithStops[], weekStartDay: number) {
  const map = new Map<string, LoadWithStops[]>();
  for (const load of loads) {
    const key = workWeekStart(load.load_date, weekStartDay);
    const list = map.get(key) ?? [];
    list.push(load);
    map.set(key, list);
  }
  return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
}

export default async function LoadsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseYearMonth(params.month);
  const { start: monthStart } = monthBounds(year, month);
  const viewFull = params.view === "full";

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
  const weekStartDay = profile?.week_start_day ?? 5;
  const scope = { userId, role: profile!.role };

  const [monthLoads, latestAdpEntry, monthWorkedMinutes] = await Promise.all([
    getLoadsForMonth(year, month, scope),
    getLatestAdp(userId),
    getMonthWorkedMinutes(userId, year, month),
  ]);

  const olderLoads = isCurrentMonth
    ? await getOlderLoads(monthStart, { ...scope, limit: 50 })
    : [];

  const latestAdp =
    latestAdpEntry != null ? Number(latestAdpEntry.adp_amount) : null;
  // Charts + totals always use the full month payload (preview only trims the list UI).
  const monthTotals = summarizeMonthLoads(
    monthLoads,
    Number.isFinite(latestAdp) ? latestAdp : null,
    monthWorkedMinutes,
  );
  const monthChartDays = buildMonthChartDays(monthLoads, year, month);

  /**
   * UX choice: current month defaults to the 5 most recent loads with a
   * “View full month” CTA (`?view=full`). Other months (via month navigator)
   * show the full list immediately — the user already chose that month.
   */
  const usePreview =
    isCurrentMonth && !viewFull && monthLoads.length > PREVIEW_LIMIT;
  const displayedLoads = usePreview
    ? monthLoads.slice(0, PREVIEW_LIMIT)
    : monthLoads;
  const showWeekGroups = !isCurrentMonth || (viewFull && !usePreview);
  const weekGroups = showWeekGroups
    ? groupByWorkWeek(displayedLoads, weekStartDay)
    : [];

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 p-4 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className={pageTitleClassName}>Loads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your private load history, month charts, and totals.
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

      <LoadsMonthTotals totals={monthTotals} />

      <section className="space-y-3">
        <h2
          className={`text-sm font-semibold uppercase tracking-wide ${sectionHeadingColorClassName}`}
        >
          Month charts
        </h2>
        <LoadsMonthCharts days={monthChartDays} />
      </section>

      <section className="space-y-4">
        <h2
          className={`text-sm font-semibold uppercase tracking-wide ${sectionHeadingColorClassName}`}
        >
          {isCurrentMonth
            ? usePreview
              ? "Recent loads"
              : "This month"
            : formatMonthLabel(year, month)}
        </h2>

        {monthLoads.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No loads in {formatMonthLabel(year, month)}.
          </p>
        ) : showWeekGroups ? (
          <div className="space-y-6">
            {weekGroups.map(([weekStart, loads]) => (
              <div key={weekStart}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatWeekLabel(weekStart)}
                </h3>
                <div className="space-y-3">
                  {loads.map((load) => (
                    <LoadCard key={load.id} load={load} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedLoads.map((load) => (
              <LoadCard key={load.id} load={load} />
            ))}
          </div>
        )}

        {isCurrentMonth ? (
          <LoadsListExpand
            year={year}
            month={month}
            previewLimit={PREVIEW_LIMIT}
            totalCount={monthLoads.length}
            expanded={viewFull}
          />
        ) : null}
      </section>

      {isCurrentMonth && olderLoads.length > 0 ? (
        <section>
          <h2
            className={`text-sm font-semibold uppercase tracking-wide ${sectionHeadingColorClassName}`}
          >
            Older loads
          </h2>
          <div className="mt-2 rounded-2xl border border-border bg-background px-4">
            {olderLoads.map((load) => (
              <LoadListRow key={load.id} load={load} />
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Browse other months with the arrows above, or open{" "}
            <Link href={loadsHref({ year, month })} className="underline">
              this month
            </Link>
            .
          </p>
        </section>
      ) : null}
    </main>
  );
}
