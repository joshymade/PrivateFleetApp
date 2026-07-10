import Link from "next/link";
import { notFound } from "next/navigation";
import { CompleteLoadButton } from "@/components/loads/complete-load-button";
import { LoadLabel } from "@/components/loads/load-label";
import { StopCompletedToggle } from "@/components/loads/stop-completed-toggle";
import { BackLink } from "@/components/nav/back-link";
import { DriverId, driverIdClassName } from "@/components/ui/driver-id";
import { pageTitleClassName } from "@/components/ui/page-title";
import { formatLongDate } from "@/lib/loads/date";
import {
  formatTrailerSequence,
  statusBadgeClassName,
  statusLabel,
  stopTypeLabel,
  stopTypeNameClass,
} from "@/lib/loads/format";
import { getLoadById, getSessionProfile } from "@/lib/loads/queries";
import { displayFirstOrFull } from "@/lib/profile-name";

export default async function LoadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const load = await getLoadById(id);
  if (!load) notFound();

  const { userId, profile } = await getSessionProfile();
  const canManage =
    Boolean(userId) &&
    (profile?.role === "driver" || profile?.role === "admin");

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 p-4 pb-8">
      <header>
        <BackLink href="/loads" aria-label="Back to Loads">
          Loads
        </BackLink>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {formatLongDate(load.load_date)}
            </p>
            <h1 className={pageTitleClassName}>
              <LoadLabel loadNumber={load.load_number} />
            </h1>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClassName(load.status)}`}
          >
            {statusLabel(load.status)}
          </span>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-background p-4">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Trailer(s)</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {formatTrailerSequence(
                load,
                load.load_stops,
                load.load_trailer_history,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Miles</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {load.assigned_miles != null ? load.assigned_miles : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Route #</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {load.route_number ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Driver</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {load.assigned_driver?.full_name ? (
                displayFirstOrFull(load.assigned_driver.full_name, "")
              ) : load.assigned_driver?.driver_id ? (
                <DriverId>{load.assigned_driver.driver_id}</DriverId>
              ) : (
                "Unassigned"
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Stops
        </h2>
        {load.load_stops.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No stops logged.</p>
        ) : (
          <ol className="mt-2 space-y-1 rounded-2xl border border-border bg-background p-3">
            {load.load_stops.map((stop) => (
              <li key={stop.id} className="text-sm">
                <StopCompletedToggle
                  stopId={stop.id}
                  completed={stop.completed}
                  canToggle={canManage}
                  variant="page"
                >
                  <span className="font-medium text-muted-foreground">
                    {stop.delivery_order}. {stopTypeLabel(stop.stop_type)} ·{" "}
                  </span>
                  <span
                    className={`font-medium ${stopTypeNameClass(stop.stop_type)}`}
                  >
                    {stop.stop_name}
                  </span>
                  {stop.pickup_number ? (
                    <>
                      <span className="text-muted-foreground"> · Pickup </span>
                      <span className={driverIdClassName}>
                        {stop.pickup_number}
                      </span>
                    </>
                  ) : null}
                  {stop.trailer_number ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · Trailer {stop.trailer_number}
                    </span>
                  ) : null}
                </StopCompletedToggle>
              </li>
            ))}
          </ol>
        )}
      </section>

      {load.load_trailer_history.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Trailer history
          </h2>
          <ul className="mt-2 space-y-2 rounded-2xl border border-border bg-background p-4 text-sm">
            {load.load_trailer_history.map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span className="font-medium text-foreground">
                  {row.trailer_number}
                </span>
                <span className="text-muted-foreground">
                  {new Date(row.changed_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canManage ? (
        <section className="space-y-3">
          <Link
            href={`/loads/${load.id}/edit`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-background text-sm font-medium text-foreground"
          >
            Edit load
          </Link>
          {load.status === "active" ? (
            <CompleteLoadButton loadId={load.id} />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
