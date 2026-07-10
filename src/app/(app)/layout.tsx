import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/nav/app-page-header";
import { BottomNav } from "@/components/nav/bottom-nav";
import {
  driverNeedsProfileSetup,
  getSessionProfile,
  PROFILE_SETUP_PATH,
} from "@/lib/auth/profile";
import {
  ADMIN_FEED_BADGE_TYPES,
  DRIVER_FEED_BADGE_TYPES,
  SAFETY_FEED_NOTIFICATION_TYPES,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionProfile();
  if (!session) {
    redirect("/login");
  }

  const profileIncomplete = driverNeedsProfileSetup(
    session.role,
    session.profile,
  );

  const supabase = await createClient();

  // Safety Feed badges pending inbox work; drivers/admins badge Feed activity.
  let unreadNotifications = 0;
  if (session.role === "safety") {
    const [{ count: pendingInbox }, { count: unreadReferrals }] =
      await Promise.all([
        supabase
          .from("safety_inbox_items")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.userId)
          .in("type", SAFETY_FEED_NOTIFICATION_TYPES)
          .is("read_at", null),
      ]);
    unreadNotifications = Math.max(pendingInbox ?? 0, unreadReferrals ?? 0);
  } else {
    const badgeTypes =
      session.role === "admin"
        ? ADMIN_FEED_BADGE_TYPES
        : DRIVER_FEED_BADGE_TYPES;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .in("type", badgeTypes)
      .is("read_at", null);
    unreadNotifications = count ?? 0;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-lg flex-1 pb-20">
        <div className="px-4 pt-4 pb-4">
          <AppPageHeader profile={session.profile} role={session.role} />
        </div>
        {children}
      </div>
      <BottomNav
        role={session.role}
        unreadNotifications={unreadNotifications}
        profileIncomplete={profileIncomplete}
        profileSetupHref={PROFILE_SETUP_PATH}
      />
    </div>
  );
}
