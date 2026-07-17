import { redirect } from "next/navigation";
import { getPostAuthLandingPath } from "@/lib/auth/landing";
import { driverNeedsProfileSetup } from "@/lib/auth/profile-complete";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, work_state")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as UserRole | undefined) ?? "driver";
  const needsSetup = driverNeedsProfileSetup(role, profile);
  const landing = await getPostAuthLandingPath(supabase, {
    userId: user.id,
    needsSetup,
  });

  redirect(landing.href);
}
