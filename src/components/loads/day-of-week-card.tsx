import Link from "next/link";
import { CurrentTrailerField } from "@/components/loads/current-trailer-field";
import { StopCompletedToggle } from "@/components/loads/stop-completed-toggle";
import { StopTrailerField } from "@/components/loads/stop-trailer-field";
import { driverIdClassName } from "@/components/ui/driver-id";
import { pageTitleColorClassName } from "@/components/ui/page-title";
import {
  formatDayOfWeek,
  formatLongDate,
  isoWeekNumber,
} from "@/lib/loads/date";
import { RouteSnippet } from "@/components/loads/route-snippet";
import {
  formatTrailerSequence,
  statusLabel,
  stopTypeLabel,
  stopTypeNameClass,
} from "@/lib/loads/format";
import type { LoadWithStops } from "@/lib/loads/queries";
import type { UserRole } from "@/types/database";

export function DayOfWeekCard({
  today,
  load,
  canManage,
  role,
}: {
  today: string;
  load: LoadWithStops | null;
  canManage: boolean;
  role: UserRole;
}) {
  const dayName = formatDayOfWeek(today);
  const week = isoWeekNumber(today);

  return (
    <div className="space-y-3">
      {canManage ? (
        <Link
          href="/loads/new"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground"
        >
          Quick add load
        </Link>
      ) : null}

      <section className="rounded-3xl bg-slate-100 px-5 py-6 text-foreground shadow-sm dark:bg-brand-panel dark:text-white">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground dark:text-white/70">
            {formatLongDate(today)}
          </p>
          <span className="shrink-0 rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-semibold tracking-wide text-foreground/90 ring-1 ring-accent/70 dark:bg-background/15 dark:text-white/90">
            Week {week}
          </span>
        </div>
        <h2
          className={`mt-1 text-4xl font-semibold tracking-tight ${pageTitleColorClassName}`}
        >
          {dayName}
        </h2>

        {load ? (
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-white/60">
                Current load
              </p>
              <Link
                href={`/loads/${load.id}`}
                className="mt-1 block text-2xl font-bold tracking-tight text-accent underline-offset-4 hover:underline"
              >
                #{load.load_number}
              </Link>
            </div>

            <CurrentTrailerField
              trailerNumber={load.trailer_number}
              variant="panel"
            />

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <dt className="text-muted-foreground dark:text-white/60">
                  Trailer(s)
                </dt>
                <dd className="mt-0.5 font-medium">
                  {formatTrailerSequence(load, load.load_stops)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground dark:text-white/60">
                  Status
                </dt>
                <dd className="mt-0.5 font-medium">{statusLabel(load.status)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground dark:text-white/60">
                  Route
                </dt>
                <dd className="mt-0.5 font-medium">
                  <RouteSnippet
                    load={load}
                    separatorClassName="text-muted-foreground dark:text-white/50"
                  />
                </dd>
              </div>
              {load.paid_miles != null ? (
                <div>
                  <dt className="text-muted-foreground dark:text-white/60">
                    Paid miles
                  </dt>
                  <dd className="mt-0.5 font-medium">{load.paid_miles}</dd>
                </div>
              ) : null}
              {load.route_number ? (
                <div>
                  <dt className="text-muted-foreground dark:text-white/60">
                    Route #
                  </dt>
                  <dd className="mt-0.5 font-medium">{load.route_number}</dd>
                </div>
              ) : null}
            </dl>
            {load.load_stops.length > 0 ? (
              <ol className="space-y-2 border-t border-border pt-3 text-sm text-foreground/90 dark:border-white/20 dark:text-white/90">
                {load.load_stops.map((stop) => (
                  <li key={stop.id}>
                    <StopCompletedToggle
                      stopId={stop.id}
                      completed={stop.completed}
                      canToggle={canManage}
                      variant="panel"
                    >
                      <span className="text-muted-foreground dark:text-white/60">
                        {stop.delivery_order}.
                      </span>{" "}
                      <span className="text-muted-foreground dark:text-white/60">
                        {stopTypeLabel(stop.stop_type)}
                      </span>{" "}
                      <span className={stopTypeNameClass(stop.stop_type)}>
                        {stop.stop_name}
                      </span>
                      {stop.pickup_number ? (
                        <>
                          <span className="text-muted-foreground dark:text-white/60">
                            {" "}
                            · PU{" "}
                          </span>
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
                      canEdit={canManage}
                      variant="panel"
                    />
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-background/70 px-4 py-5 dark:border-white/30 dark:bg-background/10">
            <p className="text-base font-medium">No load for today</p>
            <p className="mt-1 text-sm text-muted-foreground dark:text-white/70">
              {role === "safety"
                ? "Use Feed or Safety inbox for review work."
                : "Add a load to see it on today’s card."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
