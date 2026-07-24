import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  ContactReply,
  ContactRequest,
  Profile,
  UserRole,
} from "@/types/database";

export type AdminUserListItem = {
  id: string;
  driver_id: string | null;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  disabled_at: string | null;
  created_at: string;
  report_count: number;
  load_count: number;
  /**
   * Prefer auth.users.last_sign_in_at via service role; fallback profiles.updated_at.
   */
  last_active_at: string | null;
  last_active_source: "last_sign_in" | "updated_at" | "none";
};

export type AdminUserDetail = AdminUserListItem & {
  updated_at: string;
  contact_requests: ContactRequest[];
  contact_replies: ContactReply[];
};

type ProfileRow = Pick<
  Profile,
  | "id"
  | "driver_id"
  | "email"
  | "full_name"
  | "role"
  | "disabled_at"
  | "created_at"
  | "updated_at"
>;

async function lastSignInMap(
  userIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (userIds.length === 0) return map;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error || !data?.users) return map;

    const wanted = new Set(userIds);
    for (const u of data.users) {
      if (wanted.has(u.id)) {
        map.set(u.id, u.last_sign_in_at ?? null);
      }
    }
  } catch {
    // Service role missing — callers fall back to profiles.updated_at.
  }

  return map;
}

function toListItem(
  profile: ProfileRow,
  reportCount: number,
  loadCount: number,
  lastSignIn: string | null | undefined,
): AdminUserListItem {
  if (lastSignIn) {
    return {
      id: profile.id,
      driver_id: profile.driver_id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      disabled_at: profile.disabled_at,
      created_at: profile.created_at,
      report_count: reportCount,
      load_count: loadCount,
      last_active_at: lastSignIn,
      last_active_source: "last_sign_in",
    };
  }
  if (profile.updated_at) {
    return {
      id: profile.id,
      driver_id: profile.driver_id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      disabled_at: profile.disabled_at,
      created_at: profile.created_at,
      report_count: reportCount,
      load_count: loadCount,
      last_active_at: profile.updated_at,
      last_active_source: "updated_at",
    };
  }
  return {
    id: profile.id,
    driver_id: profile.driver_id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    disabled_at: profile.disabled_at,
    created_at: profile.created_at,
    report_count: reportCount,
    load_count: loadCount,
    last_active_at: null,
    last_active_source: "none",
  };
}

export async function listAdminUsers(): Promise<{
  users: AdminUserListItem[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, driver_id, email, full_name, role, disabled_at, created_at, updated_at",
    )
    .order("created_at", { ascending: true });

  if (error) return { users: [], error: error.message };

  const profiles = (data ?? []) as ProfileRow[];
  const ids = profiles.map((p) => p.id);
  if (ids.length === 0) return { users: [], error: null };

  const [{ data: reportRows }, { data: loadRows }, signInMap] =
    await Promise.all([
      supabase.from("damage_reports").select("reported_by").in("reported_by", ids),
      supabase
        .from("loads")
        .select("assigned_driver_id")
        .in("assigned_driver_id", ids),
      lastSignInMap(ids),
    ]);

  const reportCounts = new Map<string, number>();
  for (const row of reportRows ?? []) {
    const id = row.reported_by as string;
    reportCounts.set(id, (reportCounts.get(id) ?? 0) + 1);
  }
  const loadCounts = new Map<string, number>();
  for (const row of loadRows ?? []) {
    const id = row.assigned_driver_id as string | null;
    if (!id) continue;
    loadCounts.set(id, (loadCounts.get(id) ?? 0) + 1);
  }

  const users = profiles.map((p) =>
    toListItem(
      p,
      reportCounts.get(p.id) ?? 0,
      loadCounts.get(p.id) ?? 0,
      signInMap.get(p.id),
    ),
  );

  return { users, error: null };
}

export async function getAdminUserDetail(
  userId: string,
): Promise<{ user: AdminUserDetail | null; error: string | null }> {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, driver_id, email, full_name, role, disabled_at, created_at, updated_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) return { user: null, error: error.message };
  if (!profile) return { user: null, error: "User not found." };

  const typed = profile as ProfileRow;

  const [
    { count: reportCount },
    { count: loadCount },
    signInMap,
    { data: requestRows },
  ] = await Promise.all([
    supabase
      .from("damage_reports")
      .select("id", { count: "exact", head: true })
      .eq("reported_by", userId),
    supabase
      .from("loads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_driver_id", userId),
    lastSignInMap([userId]),
    supabase
      .from("contact_requests")
      .select("id, driver_id, category, message, created_at")
      .eq("driver_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  const contactRequests = (requestRows ?? []) as ContactRequest[];
  let contactReplies: ContactReply[] = [];

  if (contactRequests.length > 0) {
    const { data: replyRows } = await supabase
      .from("contact_replies")
      .select("id, contact_request_id, admin_id, body, created_at, read_at")
      .in(
        "contact_request_id",
        contactRequests.map((r) => r.id),
      )
      .order("created_at", { ascending: true });
    contactReplies = (replyRows ?? []) as ContactReply[];
  }

  const base = toListItem(
    typed,
    reportCount ?? 0,
    loadCount ?? 0,
    signInMap.get(userId),
  );

  return {
    user: {
      ...base,
      updated_at: typed.updated_at,
      contact_requests: contactRequests,
      contact_replies: contactReplies,
    },
    error: null,
  };
}
