import { notFound, redirect } from "next/navigation";
import { LoadForm } from "@/components/loads/load-form";
import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";
import {
  driverNeedsProfileSetup,
  PROFILE_SETUP_PATH,
} from "@/lib/auth/profile";
import { formatLoadLabel } from "@/lib/loads/format";
import { getLoadById, getSessionProfile } from "@/lib/loads/queries";

export default async function EditLoadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const load = await getLoadById(id);
  if (!load) notFound();

  const { userId, profile } = await getSessionProfile();
  const role = profile?.role ?? "driver";

  if (userId && driverNeedsProfileSetup(role, profile)) {
    redirect(PROFILE_SETUP_PATH);
  }

  const canManage =
    Boolean(userId) && (role === "driver" || role === "admin");

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 p-4 pb-8">
      <header>
        <BackLink
          href={`/loads/${load.id}`}
          aria-label={`Back to ${formatLoadLabel(load.load_number)}`}
        >
          {formatLoadLabel(load.load_number)}
        </BackLink>
        <h1 className={`mt-3 ${pageTitleClassName}`}>Edit load</h1>
      </header>

      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          Only drivers and admins can edit loads.
        </p>
      ) : (
        <LoadForm
          mode="edit"
          load={load}
          stops={load.load_stops}
          showAssignField={profile?.role === "admin"}
        />
      )}
    </main>
  );
}
