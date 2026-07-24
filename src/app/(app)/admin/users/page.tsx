import { redirect } from "next/navigation";
import { AdminCreateUserForm } from "@/components/admin/admin-create-user-form";
import { AdminUsersList } from "@/components/admin/admin-users-list";
import { pageTitleClassName } from "@/components/ui/page-title";
import { canAccessAdminUsers, getSessionProfile } from "@/lib/auth/profile";
import { listAdminUsers } from "@/lib/admin/users";

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const session = await getSessionProfile();
  if (!session || !canAccessAdminUsers(session.role)) {
    redirect("/account");
  }

  const { users, error } = await listAdminUsers();

  return (
    <main className="flex flex-col gap-4 p-4 pb-8 pt-2">
      <div>
        <h1 className={pageTitleClassName}>Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fleet accounts, activity, and management. Tap a user for messages and
          actions.
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Last active prefers Auth last sign-in; falls back to profile updated
          time when unavailable.
        </p>
      </div>

      <AdminCreateUserForm />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <AdminUsersList users={users} />
      )}
    </main>
  );
}
