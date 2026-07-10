import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminContactEmailForm } from "@/components/profile/admin-contact-email-form";
import { ContactAdminButton } from "@/components/profile/contact-admin-button";
import { EmailPrivacyHint } from "@/components/profile/email-privacy-hint";
import { ProfileNameForm } from "@/components/profile/profile-name-form";
import { ProfileWorkStateForm } from "@/components/profile/profile-work-state-form";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { DriverId } from "@/components/ui/driver-id";
import { pageTitleClassName } from "@/components/ui/page-title";
import {
  canAccessAdminUsers,
  canAccessSafetyInbox,
  driverNeedsProfileSetup,
  getSessionProfile,
  isProfileComplete,
} from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const session = await getSessionProfile();
  if (!session) return null;

  const { profile, role, email } = session;
  const setupMode = driverNeedsProfileSetup(role, profile);
  const identityLocked =
    role === "driver" &&
    isProfileComplete(profile) &&
    (profile?.identity_changes_remaining ?? 0) <= 0;
  const showOneEditHint =
    role === "driver" &&
    isProfileComplete(profile) &&
    (profile?.identity_changes_remaining ?? 0) === 1;

  let pendingInbox: number | null = null;
  if (canAccessSafetyInbox(role)) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("safety_inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingInbox = count ?? 0;
  }

  return (
    <main className="flex flex-col gap-8 p-6 pt-3">
      <div>
        <h1 className={pageTitleClassName}>Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {setupMode
            ? "Finish your profile to unlock reporting and loads."
            : "Your account details and preferences."}
        </p>
      </div>

      {setupMode ? (
        <div
          className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          <p className="font-medium">Complete your profile to continue</p>
          <p className="mt-1 text-muted-foreground">
            Set your first name and the state you run out of. Then you can
            submit damage reports and manage loads.
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">
          {role === "driver" ? "Your Driver Details" : "Details"}
        </h2>
        {showOneEditHint ? (
          <p className="text-xs text-muted-foreground">
            You can change your name or work state one more time. After that,
            you&apos;ll need to contact Admin.
          </p>
        ) : null}
        {identityLocked ? (
          <p className="text-xs text-muted-foreground" role="status">
            Name and work state are locked. Contact Admin to request a change.
          </p>
        ) : null}
        <ProfileNameForm
          initialName={profile?.full_name ?? ""}
          identityLocked={identityLocked}
        />
        <div className="border-t border-border pt-4">
          <ProfileWorkStateForm
            initialWorkState={profile?.work_state ?? null}
            identityLocked={identityLocked}
          />
        </div>
        {identityLocked ? (
          <ContactAdminButton
            defaultEmail={email ?? ""}
            driverId={profile?.driver_id ?? null}
          />
        ) : null}
        <dl className="grid gap-3 border-t border-border pt-4 text-sm">
          <div>
            <dt className="flex items-center gap-1 text-muted-foreground">
              Email
              <EmailPrivacyHint />
            </dt>
            <dd className="font-medium text-foreground">{email || "—"}</dd>
          </div>
          {role === "driver" || role === "admin" ? (
            <div>
              <dt className="text-muted-foreground">Driver ID</dt>
              <dd>
                {profile?.driver_id ? (
                  <DriverId>{profile.driver_id}</DriverId>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">Role</dt>
            <dd>
              <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-sm font-medium capitalize text-foreground">
                {role}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {role === "admin" && !setupMode ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            Driver contact requests
          </h2>
          <AdminContactEmailForm
            initialEmail={profile?.admin_contact_email ?? null}
          />
        </section>
      ) : null}

      {!setupMode ? (
        <>
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
            <p className="text-xs text-muted-foreground">
              Choose light or dark. Preference is saved on this device.
            </p>
            <ThemeToggle />
          </section>

          {canAccessSafetyInbox(role) || canAccessAdminUsers(role) ? (
            <ul className="flex flex-col gap-2 text-sm">
              {canAccessSafetyInbox(role) ? (
                <li>
                  <Link
                    href="/safety/inbox"
                    className="font-medium text-brand underline-offset-2 hover:underline"
                  >
                    {role === "safety" ? "Safety Feed" : "Safety inbox"}
                    {pendingInbox != null && pendingInbox > 0
                      ? ` (${pendingInbox} pending)`
                      : ""}
                  </Link>
                </li>
              ) : null}
              {canAccessAdminUsers(role) ? (
                <li>
                  <Link
                    href="/admin/users"
                    className="font-medium text-brand underline-offset-2 hover:underline"
                  >
                    Manage users
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : null}
        </>
      ) : null}

      <SignOutButton />
    </main>
  );
}
