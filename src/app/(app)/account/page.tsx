import Link from "next/link";
import { AccountDataResetButtons } from "@/components/account/account-data-reset-buttons";
import { AccountNavCard } from "@/components/account/account-nav-card";
import { AccountSettingsSection } from "@/components/account/account-settings-section";
import { AdminSiteAlertForm } from "@/components/account/admin-site-alert-form";
import { AdminSplashTextForm } from "@/components/account/admin-splash-text-form";
import { AdpHistorySection } from "@/components/account/adp-history-section";
import { DriverWeekSettings } from "@/components/account/driver-week-settings";
import { PayPeriodSettings } from "@/components/account/next-pay-date-settings";
import { ProfileRegionForm } from "@/components/account/profile-region-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ContactAdminButton } from "@/components/profile/contact-admin-button";
import { EmailPrivacyHint } from "@/components/profile/email-privacy-hint";
import { ProfileNameForm } from "@/components/profile/profile-name-form";
import { ProfileWorkStateForm } from "@/components/profile/profile-work-state-form";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";
import { DriverId } from "@/components/ui/driver-id";
import { pageTitleClassName } from "@/components/ui/page-title";
import {
  canAccessAdminUsers,
  canAccessSafetyInbox,
  driverNeedsProfileSetup,
  getSessionProfile,
  isProfileComplete,
} from "@/lib/auth/profile";
import { listSiteAlertsForAdmin } from "@/lib/site-alerts.server";
import { SPLASH_TEXT_KEY } from "@/lib/splash";
import { createClient } from "@/lib/supabase/server";
import type { AdpEntry, SiteAlert } from "@/types/database";

export const metadata = {
  title: "Account",
};

export default async function AccountPage() {
  const session = await getSessionProfile();
  if (!session) return null;

  const { profile, role, email, userId } = session;
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
  let pendingDeletionRequests: number | null = null;
  let adpEntries: AdpEntry[] = [];
  let splashTextRaw = "";
  let siteAlerts: SiteAlert[] = [];

  const supabase = await createClient();
  if (canAccessSafetyInbox(role)) {
    const { count } = await supabase
      .from("safety_inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingInbox = count ?? 0;
  }

  if (canAccessAdminUsers(role)) {
    const [{ count }, { data: splashSetting }, alertsResult] =
      await Promise.all([
        supabase
          .from("report_deletion_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", SPLASH_TEXT_KEY)
          .maybeSingle(),
        listSiteAlertsForAdmin(),
      ]);
    pendingDeletionRequests = count ?? 0;
    splashTextRaw = splashSetting?.value ?? "";
    siteAlerts = alertsResult.alerts;
  }

  if (role === "driver" && !setupMode) {
    const { data } = await supabase
      .from("adp_entries")
      .select("*")
      .eq("driver_id", userId)
      .order("period_start", { ascending: false })
      .limit(24);
    adpEntries = (data as AdpEntry[] | null) ?? [];
  }

  const weekStartDay = profile?.week_start_day ?? 5;
  const offDays = profile?.off_days ?? [];
  const showTeamTools =
    !setupMode && (canAccessSafetyInbox(role) || canAccessAdminUsers(role));

  return (
    <main className="flex flex-col gap-8 p-6 pt-3">
      <div>
        <h1 className={pageTitleClassName}>Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {setupMode
            ? "Finish your profile to unlock reporting and loads."
            : "Your details, settings, and account pages."}
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

      <AccountSettingsSection
        title={role === "driver" ? "Profile" : "Details"}
        id="account-section-profile"
      >
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
          <ContactAdminButton driverId={profile?.driver_id ?? null} />
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
              <dt className="text-muted-foreground">
                <ClickableTooltip
                  ariaLabel="Driver ID privacy: learn more"
                  content="Your Driver ID is private. Only Safety can see it when a damage report is submitted to them."
                >
                  Driver ID
                </ClickableTooltip>
              </dt>
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
          {role === "safety" ? (
            <div>
              <dt className="text-muted-foreground">Region</dt>
              <dd className="font-medium text-foreground">
                {profile?.region != null
                  ? `Region ${profile.region}`
                  : "Not assigned — contact Admin"}
              </dd>
            </div>
          ) : null}
        </dl>
      </AccountSettingsSection>

      {role === "driver" && !setupMode ? (
        <>
          <AccountSettingsSection title="Region">
            {profile?.region_locked ? (
              <p className="text-xs text-muted-foreground" role="status">
                Region is locked. Contact Admin to request a change.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Choose once. After you save, only Admin can change it.
              </p>
            )}
            <ProfileRegionForm
              initialRegion={profile?.region ?? null}
              regionLocked={Boolean(profile?.region_locked)}
              driverId={profile?.driver_id ?? null}
            />
          </AccountSettingsSection>

          <AccountSettingsSection
            title="Work week"
            description="Truck number for new loads, when your week starts, and usual days off."
          >
            <DriverWeekSettings
              weekStartDay={weekStartDay}
              offDays={offDays}
              currentTruckNumber={profile?.current_truck_number ?? null}
            />
          </AccountSettingsSection>

          <AccountSettingsSection
            title="Pay period"
            description="Set your current (or next) pay period start and end. Periods end on Friday; checks deposit on Thursday (shown with the $ icon on Home). Later periods advance automatically with the same length."
          >
            <PayPeriodSettings
              payPeriodStart={profile?.pay_period_start ?? null}
              nextPayDate={profile?.next_pay_date ?? null}
            />
          </AccountSettingsSection>

          <AccountSettingsSection
            title="Average Daily Pay"
            description="Enter your ADP each biweekly pay period. Latest ADP also shows on Home."
          >
            <AdpHistorySection entries={adpEntries} />
          </AccountSettingsSection>

          <AccountSettingsSection
            title="Data"
            description="Clear your loads or remove your name from damage reports. Only Admin can permanently delete reports."
          >
            <AccountDataResetButtons />
          </AccountSettingsSection>
        </>
      ) : null}

      {!setupMode ? (
        <AccountSettingsSection
          title="Pages"
          description="Legal and contact."
          bare
        >
          <AccountNavCard
            href="/account/legal"
            title="Legal"
            description="FAQ, privacy policy, and terms of service"
          />
          <AccountNavCard
            href="/account/contact"
            title="Contact"
            description="Reach Admin about info, issues, or ideas"
          />
        </AccountSettingsSection>
      ) : null}

      {role === "admin" && !setupMode ? (
        <>
          <AccountSettingsSection
            title="Site notice"
            description="One-sentence bar at the top of the app on the days you choose (holidays, closings, etc.)."
          >
            <AdminSiteAlertForm initialAlerts={siteAlerts} />
          </AccountSettingsSection>
          <AccountSettingsSection
            title="Splash screen"
            description="Description shown on the welcome splash before Enter. Shared for everyone."
          >
            <AdminSplashTextForm initialText={splashTextRaw} />
          </AccountSettingsSection>
        </>
      ) : null}

      {!setupMode ? (
        <AccountSettingsSection
          title="Appearance"
          description="Choose light or dark. Preference is saved on this device."
        >
          <ThemeToggle />
        </AccountSettingsSection>
      ) : null}

      {showTeamTools ? (
        <AccountSettingsSection title="Team tools" bare>
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
              <>
                <li>
                  <Link
                    href="/admin/users"
                    className="font-medium text-brand underline-offset-2 hover:underline"
                  >
                    Manage users
                  </Link>
                </li>
                <li>
                  <Link
                    href="/admin/deletion-requests"
                    className="font-medium text-brand underline-offset-2 hover:underline"
                  >
                    Deletion requests
                    {pendingDeletionRequests != null &&
                    pendingDeletionRequests > 0
                      ? ` (${pendingDeletionRequests} pending)`
                      : ""}
                  </Link>
                </li>
              </>
            ) : null}
          </ul>
        </AccountSettingsSection>
      ) : null}

      <AccountSettingsSection title="Session" bare>
        <SignOutButton />
      </AccountSettingsSection>
    </main>
  );
}
