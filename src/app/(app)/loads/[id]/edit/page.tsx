import { notFound, redirect } from "next/navigation";
import { ArchiveDeleteLoad } from "@/components/loads/archive-delete-load";
import { LoadForm } from "@/components/loads/load-form";
import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";
import {
  driverNeedsProfileSetup,
  PROFILE_SETUP_PATH,
} from "@/lib/auth/profile";
import {
  formatLoadLabel,
  stopTypeLabel,
  stopTypeNameClass,
} from "@/lib/loads/format";
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

  const isOwner = Boolean(userId) && load.assigned_driver_id === userId;
  const canManage = isOwner && (role === "driver" || role === "admin");
  const departedStops = load.load_stops.filter((s) => s.completed);

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
          Only the assigned driver can edit this load.
        </p>
      ) : (
        <>
          <LoadForm mode="edit" load={load} stops={load.load_stops} />

          {departedStops.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Depart History
              </h2>
              <ul className="mt-2 space-y-2 rounded-2xl border border-border bg-background p-4 text-sm">
                {departedStops.map((stop) => (
                  <li key={stop.id} className="space-y-0.5">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium text-foreground">
                        {stop.delivery_order}. {stopTypeLabel(stop.stop_type)} ·{" "}
                        <span className={stopTypeNameClass(stop.stop_type)}>
                          {stop.stop_name}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {stop.arrived_at
                          ? new Date(stop.arrived_at).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    {stop.trailer_number ? (
                      <p className="text-xs text-muted-foreground">
                        Trailer {stop.trailer_number}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <ArchiveDeleteLoad loadId={load.id} status={load.status} />
        </>
      )}
    </main>
  );
}
