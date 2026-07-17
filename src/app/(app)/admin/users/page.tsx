import { redirect } from "next/navigation";
import { UsersRoleManager } from "@/components/admin/users-role-manager";
import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";
import { canAccessAdminUsers, getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export default async function AdminUsersPage() {
  const session = await getSessionProfile();
  if (!session || !canAccessAdminUsers(session.role)) {
    redirect("/account");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, driver_id, email, full_name, role, created_at, updated_at")
    .order("created_at", { ascending: true });

  const users = (data ?? []) as Profile[];

  return (
    <main className="flex flex-col gap-4 p-6">
      <div>
        <BackLink href="/account" aria-label="Back to Account">
          Account
        </BackLink>
        <h1 className={`mt-2 ${pageTitleClassName}`}>Manage users</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set role to driver, safety, or admin. Roles live on{" "}
          <code className="text-xs">public.profiles.role</code> (not Auth
          Users).
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error.message}
        </p>
      ) : (
        <UsersRoleManager users={users} currentUserId={session.userId} />
      )}
    </main>
  );
}
