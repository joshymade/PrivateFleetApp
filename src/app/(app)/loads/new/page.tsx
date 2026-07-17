import Link from "next/link";
import { redirect } from "next/navigation";
import { LoadForm } from "@/components/loads/load-form";
import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";
import {
  driverNeedsProfileSetup,
  PROFILE_SETUP_PATH,
} from "@/lib/auth/profile";
import { todayDateString } from "@/lib/loads/date";
import {
  getActiveLoadForDriver,
  getSessionProfile,
} from "@/lib/loads/queries";

export default async function NewLoadPage() {
  const { userId, profile } = await getSessionProfile();
  const role = profile?.role ?? "driver";

  if (userId && driverNeedsProfileSetup(role, profile)) {
    redirect(PROFILE_SETUP_PATH);
  }

  const canManage =
    Boolean(userId) && (role === "driver" || role === "admin");

  const activeLoad =
    userId && profile?.role === "driver"
      ? await getActiveLoadForDriver(userId)
      : null;

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 p-4 pb-8">
      <header>
        <BackLink href="/loads" aria-label="Back to Loads">
          Loads
        </BackLink>
        <h1 className={`mt-3 ${pageTitleClassName}`}>New load</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log load number, stops, and miles. Add trailers on each stop.
        </p>
      </header>

      {!userId ? (
        <p className="text-sm text-amber-800">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to create a load.
        </p>
      ) : !canManage ? (
        <p className="text-sm text-muted-foreground">
          Only drivers and admins can create loads.
        </p>
      ) : (
        <LoadForm
          mode="create"
          defaultDate={todayDateString()}
          hasActiveLoad={Boolean(activeLoad)}
          currentTruckNumber={profile?.current_truck_number ?? null}
        />
      )}
    </main>
  );
}
