import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { pageTitleClassName } from "@/components/ui/page-title";
import { getSessionProfile } from "@/lib/auth/profile";

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  if (!session.profile?.must_change_password) {
    redirect("/account");
  }

  return (
    <main className="flex flex-col gap-4 p-4 pb-8 pt-2">
      <div>
        <h1 className={pageTitleClassName}>Change password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your admin set a temporary password. Choose a new one to continue.
        </p>
      </div>
      <ChangePasswordForm />
    </main>
  );
}
