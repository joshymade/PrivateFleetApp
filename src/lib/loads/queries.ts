import { createClient } from "@/lib/supabase/server";
import type { Load, LoadStop, LoadTrailerHistory, Profile } from "@/types/database";
import { monthBounds, todayDateString } from "./date";

export type LoadWithStops = Load & {
  load_stops: LoadStop[];
};

export type LoadDetail = LoadWithStops & {
  load_trailer_history: LoadTrailerHistory[];
  assigned_driver: Pick<Profile, "id" | "full_name" | "driver_id"> | null;
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
      "id, driver_id, email, full_name, work_state, show_work_state_on_home, identity_changes_remaining, admin_contact_email, role, created_at, updated_at",
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
  /** Admin fleet overview (all drivers). Drivers always scoped to self. */
  fleet?: boolean;
};

export async function getActiveLoadForDriver(
  userId: string,
): Promise<Pick<Load, "id" | "load_number"> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loads")
    .select("id, load_number")
    .eq("assigned_driver_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function getTodayLoad(
  scope: LoadScope,
): Promise<LoadWithStops | null> {
  if (scope.role === "safety") return null;

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

  let query = supabase
    .from("loads")
    .select("*, load_stops(*)")
    .eq("load_date", today)
    .neq("status", "cancelled")
    // Prefer active, then pending, over completed (alpha: active < completed < pending).
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1);

  if (scope.role === "driver") {
    query = query.eq("assigned_driver_id", scope.userId);
  }

  const { data, error } = await query;
  if (error || !data?.length) return null;

  const row = data[0] as LoadWithStops;
  return { ...row, load_stops: sortStops(row.load_stops) };
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

  if (scope.role === "driver") {
    query = query.eq("assigned_driver_id", scope.userId);
  }

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

  if (scope.role === "driver") {
    query = query.eq("assigned_driver_id", scope.userId);
  }

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

export {
  formatTrailerSequence,
  resolveCurrentTrailerFromStops,
  routeSnippet,
  statusLabel,
  trailerSequenceParts,
} from "./format";
