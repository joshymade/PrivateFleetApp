import { todayDateString } from "@/lib/loads/date";
import { createClient } from "@/lib/supabase/server";
import type { SiteAlert } from "@/types/database";

const ALERT_SELECT =
  "id, message, starts_on, ends_on, active, created_by, created_at, updated_at";

/** Active alert whose date range includes today (most recently updated wins). */
export async function getActiveSiteAlertForToday(): Promise<SiteAlert | null> {
  const today = todayDateString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_alerts")
    .select(ALERT_SELECT)
    .eq("active", true)
    .lte("starts_on", today)
    .gte("ends_on", today)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as SiteAlert;
}

/** Recent alerts for admin management (newest first). */
export async function listSiteAlertsForAdmin(
  limit = 12,
): Promise<{ alerts: SiteAlert[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_alerts")
    .select(ALERT_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { alerts: [], error: error.message };
  return { alerts: (data ?? []) as SiteAlert[], error: null };
}
