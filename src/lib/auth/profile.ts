import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export type SessionProfile = {
  userId: string;
  email: string | null;
  profile: Profile | null;
  role: UserRole;
};

export {
  driverNeedsProfileSetup,
  isProfileComplete,
  PROFILE_INCOMPLETE_MESSAGE,
  PROFILE_SETUP_PATH,
  type ProfileCompletenessFields,
} from "@/lib/auth/profile-complete";

/** Current auth user + profiles row (role defaults to driver if missing). */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, driver_id, email, full_name, work_state, show_work_state_on_home, identity_changes_remaining, admin_contact_email, week_start_day, off_days, current_truck_number, role, disabled_at, is_system_anonymous, created_at, updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  const typed = profile as Profile | null;

  return {
    userId: user.id,
    email: user.email ?? typed?.email ?? null,
    profile: typed,
    role: typed?.role ?? "driver",
  };
}

export function canAccessReport(role: UserRole): boolean {
  return role === "driver";
}

export function canAccessLoads(role: UserRole): boolean {
  return role === "driver" || role === "admin";
}

export function canAccessSafetyInbox(role: UserRole): boolean {
  return role === "safety" || role === "admin";
}

export function canAccessAdminUsers(role: UserRole): boolean {
  return role === "admin";
}
