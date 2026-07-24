import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveDeleteLoad } from "@/components/loads/archive-delete-load";
import { CompleteLoadButton } from "@/components/loads/complete-load-button";
import { EditPayAmount } from "@/components/loads/edit-pay-amount";
import { LoadLabel } from "@/components/loads/load-label";
import { StopCompletedToggle } from "@/components/loads/stop-completed-toggle";
import { StopTrailerField } from "@/components/loads/stop-trailer-field";
import { BackLink } from "@/components/nav/back-link";
import { DriverId, driverIdClassName } from "@/components/ui/driver-id";
import { pageTitleClassName } from "@/components/ui/page-title";
import { drivenMiles, formatLongDate } from "@/lib/loads/date";
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
  const isOwner = Boolean(userId) && load.assigned_driver_id === userId;
  const canManage =
    isOwner && (profile?.role === "driver" || profile?.role === "admin");
  const driven = drivenMiles(load.starting_mileage, load.ending_mileage);
  const departedStops = load.load_stops.filter((s) => s.completed);

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
            <dt className="text-muted-foreground">Paid miles</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {load.paid_miles != null ? load.paid_miles : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Starting mileage</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {load.starting_mileage != null ? load.starting_mileage : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ending mileage</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {load.ending_mileage != null ? load.ending_mileage : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Driven miles</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {driven != null ? driven : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pay amount</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {load.pay_amount != null
                ? `$${Number(load.pay_amount).toFixed(2)}`
                : "—"}
            </dd>
            {canManage && load.status === "completed" ? (
              <dd className="mt-1">
                <EditPayAmount
                  loadId={load.id}
                  currentAmount={
                    load.pay_amount != null ? Number(load.pay_amount) : null
                  }
                />
              </dd>
            ) : null}
          </div>
          <div>
            <dt className="text-muted-foreground">Route #</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {load.route_number ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Truck #</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-foreground">
              {load.truck_number?.trim() || "—"}
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
          <ol className="mt-2 space-y-2 rounded-2xl border border-border bg-background p-3">
            {load.load_stops.map((stop) => (
              <li key={stop.id} className="text-sm">
                <StopCompletedToggle
                  stopId={stop.id}
                  completed={stop.completed}
                  canToggle={
                    canManage &&
                    (load.status === "active" || load.status === "pending")
                  }
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
                </StopCompletedToggle>
                <StopTrailerField
                  key={`${stop.id}-${stop.trailer_number ?? ""}`}
                  stopId={stop.id}
                  trailerNumber={stop.trailer_number}
                  canEdit={
                    canManage &&
                    (load.status === "active" || load.status === "pending")
                  }
                  variant="page"
                />
              </li>
            ))}
          </ol>
        )}
      </section>

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

      {canManage ? (
        <section className="space-y-3">
          <Link
            href={`/loads/${load.id}/edit`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-background text-sm font-medium text-foreground"
          >
            Edit load
          </Link>
          {load.status === "active" ? (
            <CompleteLoadButton
              loadId={load.id}
              loadDate={load.load_date}
              startingMileage={
                load.starting_mileage != null
                  ? Number(load.starting_mileage)
                  : null
              }
            />
          ) : null}
          <ArchiveDeleteLoad loadId={load.id} status={load.status} />
        </section>
      ) : null}
    </main>
  );
}
