import { notFound, redirect } from "next/navigation";
import { AdminUserDetailPanel } from "@/components/admin/admin-user-detail";
import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";
import { canAccessAdminUsers, getSessionProfile } from "@/lib/auth/profile";
import { getAdminUserDetail } from "@/lib/admin/users";

export const metadata = { title: "User detail" };

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionProfile();
  if (!session || !canAccessAdminUsers(session.role)) {
    redirect("/account");
  }

  const { id } = await params;
  const { user, error } = await getAdminUserDetail(id);

  if (error === "User not found." || !user) {
    notFound();
  }

  return (
    <main className="flex flex-col gap-4 p-4 pb-8 pt-2">
      <div>
        <BackLink href="/admin/users" aria-label="Back to Users">
          Users
        </BackLink>
        <h1 className={`mt-2 ${pageTitleClassName}`}>User</h1>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <AdminUserDetailPanel
          user={user}
          currentUserId={session.userId}
        />
      )}
    </main>
  );
}
