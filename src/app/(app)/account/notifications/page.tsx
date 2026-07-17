import { NotificationsList } from "@/components/feed/notifications-list";
import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";
import { getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { AppNotification } from "@/types/database";

export const metadata = { title: "My Notifications" };

export default async function AccountNotificationsPage() {
  const session = await getSessionProfile();
  if (!session) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = (data as AppNotification[] | null) ?? [];

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 p-4 pb-8 pt-3">
      <BackLink href="/account" aria-label="Back to Account">
        Account
      </BackLink>
      <div>
        <h1 className={pageTitleClassName}>My Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap a notification to open it. Mark items read as you go.
        </p>
      </div>
      <NotificationsList notifications={notifications} />
    </main>
  );
}
