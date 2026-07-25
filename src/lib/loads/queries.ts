import { createClient } from "@/lib/supabase/server";
import type {
  AdpEntry,
  DailyPayEntry,
  Load,
  LoadStop,
  LoadTrailerHistory,
  Profile,
} from "@/types/database";
import {
  drivenMiles,
  formatWeekLabel,
  monthBounds,
  todayDateString,
  workWeekDays,
  workWeekStart,
} from "./date";

export type LoadWithStops = Load & {
  load_stops: LoadStop[];
};

export type LoadDetail = LoadWithStops & {
  load_trailer_history: LoadTrailerHistory[];
  assigned_driver: Pick<Profile, "id" | "full_name" | "driver_id"> | null;
};

export type MonthLoadTotals = {
  latestAdp: number | null;
  drivenMiles: number;
  paidMiles: number;
  completedLoads: number;
  earnings: number;
};

export type WorkWeekChartDay = {
  date: string;
  label: string;
  earnings: number;
  driven: number;
  paid: number;
  loads: number;
};

export type WorkWeekChartSeries = {
  weekStart: string;
  weekLabel: string;
  days: WorkWeekChartDay[];
};

export async function getSessionProfile(): Promise<{
  userId: string | null;
  profile: Profile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, driver_id, email, full_name, work_state, show_work_state_on_home, identity_changes_remaining, admin_contact_email, week_start_day, off_days, next_pay_date, current_truck_number, role, created_at, updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, profile: (profile as Profile | null) ?? null };
}

function sortStops(stops: LoadStop[] | null | undefined): LoadStop[] {
  return [...(stops ?? [])].sort((a, b) => a.delivery_order - b.delivery_order);
}

type LoadScope = {
  userId: string;
  role: Profile["role"];
};

/**
 * Owner-only load visibility. Admins do not get fleet-wide load SELECT —
 * RLS and queries both scope to assigned_driver_id = userId.
 */
function applyOwnerScope<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  scope: LoadScope,
): T {
  return query.eq("assigned_driver_id", scope.userId);
}

export async function getActiveLoadForDriver(
  userId: string,
): Promise<LoadWithStops | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loads")
    .select("*, load_stops(*)")
    .eq("assigned_driver_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as LoadWithStops;
  return { ...row, load_stops: sortStops(row.load_stops) };
}

export async function getTodayLoad(
  scope: LoadScope,
): Promise<LoadWithStops | null> {
  if (scope.role === "safety" || scope.role === "admin") return null;

  const supabase = await createClient();
  const today = todayDateString();

  // Prefer the driver's active load (may be any date) for Home "current".
  if (scope.role === "driver") {
    const { data: active, error: activeError } = await supabase
      .from("loads")
      .select("*, load_stops(*)")
      .eq("assigned_driver_id", scope.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeError && active) {
      const row = active as LoadWithStops;
      return { ...row, load_stops: sortStops(row.load_stops) };
    }
  }

  const { data, error } = await supabase
    .from("loads")
    .select("*, load_stops(*)")
    .eq("assigned_driver_id", scope.userId)
    .eq("load_date", today)
    .neq("status", "cancelled")
    .neq("status", "archived")
    // Prefer active, then pending, over completed (alpha: active < completed < pending).
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;

  const row = data[0] as LoadWithStops;
  return { ...row, load_stops: sortStops(row.load_stops) };
}

/** Owner-scoped loads for a work-week date range (inclusive). */
export async function getLoadsForWorkWeek(
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<Load[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loads")
    .select(
      "id, load_number, starting_trailer_number, trailer_number, route_number, truck_number, load_date, paid_miles, starting_mileage, ending_mileage, pay_amount, assigned_driver_id, status, archived_at, created_at, updated_at",
    )
    .eq("assigned_driver_id", userId)
    .gte("load_date", weekStart)
    .lte("load_date", weekEnd)
    .neq("status", "cancelled")
    .neq("status", "archived")
    .order("load_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as Load[];
}

/** Owner-scoped completed-load count + earnings + driven miles for a calendar month. */
export async function getMonthLoadStats(
  userId: string,
  year: number,
  month: number,
): Promise<{ loadCount: number; earnings: number; drivenMiles: number }> {
  const supabase = await createClient();
  const { start, end } = monthBounds(year, month);
  const { data, error } = await supabase
    .from("loads")
    .select("status, pay_amount, starting_mileage, ending_mileage")
    .eq("assigned_driver_id", userId)
    .gte("load_date", start)
    .lte("load_date", end)
    .eq("status", "completed");

  if (error || !data) return { loadCount: 0, earnings: 0, drivenMiles: 0 };

  let earnings = 0;
  let driven = 0;
  for (const row of data as Pick<
    Load,
    "status" | "pay_amount" | "starting_mileage" | "ending_mileage"
  >[]) {
    if (row.pay_amount != null) {
      earnings += Number(row.pay_amount);
    }
    const d = drivenMiles(row.starting_mileage, row.ending_mileage);
    if (d != null) driven += d;
  }
  return { loadCount: data.length, earnings, drivenMiles: driven };
}

/** Most recent manual ADP entry for the driver (by period_start). */
export async function getLatestAdp(
  userId: string,
): Promise<AdpEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adp_entries")
    .select("*")
    .eq("driver_id", userId)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as AdpEntry;
}

/** Owner-scoped daily pay entries for a work-week date range (inclusive). */
export async function getDailyPayForWorkWeek(
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<DailyPayEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_pay_entries")
    .select("*")
    .eq("driver_id", userId)
    .gte("work_date", weekStart)
    .lte("work_date", weekEnd)
    .order("work_date", { ascending: true });

  if (error || !data) return [];
  return data as DailyPayEntry[];
}

/** Sum of daily pay amounts for a calendar month (owner-scoped).
 * Excludes days that already have a non-cancelled/non-archived load so
 * totals never double-count load pay + daily pay.
 */
export async function getMonthDailyPayTotal(
  userId: string,
  year: number,
  month: number,
): Promise<number> {
  const supabase = await createClient();
  const { start, end } = monthBounds(year, month);

  const [{ data: payRows, error: payError }, { data: loadRows, error: loadError }] =
    await Promise.all([
      supabase
        .from("daily_pay_entries")
        .select("work_date, amount")
        .eq("driver_id", userId)
        .gte("work_date", start)
        .lte("work_date", end),
      supabase
        .from("loads")
        .select("load_date")
        .eq("assigned_driver_id", userId)
        .gte("load_date", start)
        .lte("load_date", end)
        .neq("status", "cancelled")
        .neq("status", "archived"),
    ]);

  if (payError || !payRows) return 0;

  const datesWithLoads = new Set(
    !loadError && loadRows
      ? (loadRows as Pick<Load, "load_date">[]).map((r) => r.load_date)
      : [],
  );

  let total = 0;
  for (const row of payRows as Pick<DailyPayEntry, "work_date" | "amount">[]) {
    if (!datesWithLoads.has(row.work_date)) {
      total += Number(row.amount);
    }
  }
  return total;
}

/** Compact row for damage-report load linking (no stops). */
export type RecentLoadOption = Pick<
  Load,
  "id" | "load_number" | "route_number" | "load_date" | "status" | "created_at"
> & {
  /** Today's non-cancelled load for this driver (Home "current"). */
  isCurrent: boolean;
};

/** Driver's most recent loads (by load_date, then created_at), capped at `limit`. */
export async function getRecentLoadsForDriver(
  userId: string,
  limit = 10,
): Promise<RecentLoadOption[]> {
  const supabase = await createClient();
  const today = todayDateString();

  const { data, error } = await supabase
    .from("loads")
    .select("id, load_number, route_number, load_date, status, created_at")
    .eq("assigned_driver_id", userId)
    .neq("status", "cancelled")
    .order("load_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const rows = data as Omit<RecentLoadOption, "isCurrent">[];
  const currentId =
    rows.find((r) => r.status === "active")?.id ??
    rows.find((r) => r.load_date === today && r.status === "active")?.id ??
    rows.find((r) => r.load_date === today)?.id ??
    null;

  return rows.map((row) => ({
    ...row,
    isCurrent: currentId !== null && row.id === currentId,
  }));
}

export async function getLoadsForMonth(
  year: number,
  month: number,
  scope: LoadScope,
): Promise<LoadWithStops[]> {
  if (scope.role === "safety") return [];

  const supabase = await createClient();
  const { start, end } = monthBounds(year, month);

  let query = supabase
    .from("loads")
    .select("*, load_stops(*)")
    .gte("load_date", start)
    .lte("load_date", end)
    .order("load_date", { ascending: false })
    .order("created_at", { ascending: false });

  query = applyOwnerScope(query, scope);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as LoadWithStops[]).map((row) => ({
    ...row,
    load_stops: sortStops(row.load_stops),
  }));
}

export async function getOlderLoads(
  beforeDate: string,
  scope: LoadScope & { limit?: number },
): Promise<LoadWithStops[]> {
  if (scope.role === "safety") return [];

  const supabase = await createClient();
  let query = supabase
    .from("loads")
    .select("*, load_stops(*)")
    .lt("load_date", beforeDate)
    .order("load_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(scope.limit ?? 40);

  query = applyOwnerScope(query, scope);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as LoadWithStops[]).map((row) => ({
    ...row,
    load_stops: sortStops(row.load_stops),
  }));
}

export async function getLoadById(id: string): Promise<LoadDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loads")
    .select(
      `
      *,
      load_stops(*),
      load_trailer_history(*),
      assigned_driver:profiles!loads_assigned_driver_id_fkey(id, full_name, driver_id)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as LoadDetail;
  return {
    ...row,
    load_stops: sortStops(row.load_stops),
    load_trailer_history: [...(row.load_trailer_history ?? [])].sort(
      (a, b) => b.changed_at.localeCompare(a.changed_at),
    ),
  };
}

export function summarizeMonthLoads(
  loads: LoadWithStops[],
  latestAdp: number | null,
): MonthLoadTotals {
  let driven = 0;
  let paid = 0;
  let earnings = 0;
  let completedLoads = 0;

  for (const load of loads) {
    // Stats only count completed loads (archived/active/pending/cancelled excluded).
    if (load.status !== "completed") continue;

    completedLoads += 1;
    const d = drivenMiles(load.starting_mileage, load.ending_mileage);
    if (d != null) driven += d;
    if (load.paid_miles != null) paid += Number(load.paid_miles);
    if (load.pay_amount != null) earnings += Number(load.pay_amount);
  }

  return {
    latestAdp,
    drivenMiles: driven,
    paidMiles: paid,
    completedLoads,
    earnings,
  };
}

/** Work-week chart series for loads in a month, keyed by driver's week_start_day. */
export function buildWorkWeekCharts(
  loads: LoadWithStops[],
  weekStartDay: number,
): WorkWeekChartSeries[] {
  const byWeek = new Map<string, LoadWithStops[]>();
  for (const load of loads) {
    if (load.status !== "completed") continue;
    const key = workWeekStart(load.load_date, weekStartDay);
    const list = byWeek.get(key) ?? [];
    list.push(load);
    byWeek.set(key, list);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStart, weekLoads]) => {
      const days = workWeekDays(weekStart).map((date) => {
        const dayLoads = weekLoads.filter((l) => l.load_date === date);
        let earnings = 0;
        let driven = 0;
        let paid = 0;
        for (const load of dayLoads) {
          if (load.pay_amount != null) earnings += Number(load.pay_amount);
          const d = drivenMiles(load.starting_mileage, load.ending_mileage);
          if (d != null) driven += d;
          if (load.paid_miles != null) paid += Number(load.paid_miles);
        }
        const [y, m, d] = date.split("-").map(Number);
        const label = new Date(y, m - 1, d).toLocaleDateString(undefined, {
          weekday: "short",
        });
        return {
          date,
          label,
          earnings,
          driven,
          paid,
          loads: dayLoads.length,
        };
      });

      return {
        weekStart,
        weekLabel: formatWeekLabel(weekStart),
        days,
      };
    });
}

export {
  formatTrailerSequence,
  resolveCurrentStop,
  resolveCurrentTrailerFromStops,
  routeSnippet,
  statusLabel,
  trailerSequenceParts,
} from "./format";
