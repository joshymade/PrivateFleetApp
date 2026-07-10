import Link from "next/link";
import { StateIcon } from "@/components/icons";
import { DriverId } from "@/components/ui/driver-id";
import { pageTitleColorClassName } from "@/components/ui/page-title";
import { displayFirstOrFull } from "@/lib/profile-name";
import { usStateName } from "@/lib/us-states";
import type { AssetType, SafetyInboxStatus } from "@/types/database";

export type InboxListItem = {
  id: string;
  status: SafetyInboxStatus;
  sent_at: string;
  note: string | null;
  sender_name: string | null;
  sender_driver_id: string | null;
  sender_work_state: string | null;
  asset_type: AssetType;
  asset_number: string;
  driver_id: string | null;
  photo_url: string | null;
  report_comment: string | null;
};

function assetLabel(type: AssetType) {
  return type === "tractor" ? "Tractor" : "Trailer";
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusLabel(status: SafetyInboxStatus) {
  if (status === "pending") return "Pending";
  if (status === "reviewed") return "Reviewed";
  return "Dismissed";
}

function statusClass(status: SafetyInboxStatus) {
  if (status === "pending") {
    return "bg-accent/20 text-accent-foreground ring-1 ring-accent/50 dark:text-accent";
  }
  if (status === "reviewed") {
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300";
  }
  return "bg-muted text-muted-foreground";
}

export function InboxItemCard({ item }: { item: InboxListItem }) {
  const senderName = displayFirstOrFull(item.sender_name, "");
  const workState = item.sender_work_state?.trim() || null;
  const workStateLabel = workState ? usStateName(workState) : null;
  const driverId = item.sender_driver_id ?? item.driver_id;

  return (
    <Link
      href={`/safety/inbox/${item.id}`}
      className="flex gap-3 border-b border-border py-4 last:border-b-0"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photo_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No photo
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold tracking-tight">
            {assetLabel(item.asset_type)} {item.asset_number}
          </p>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(item.status)}`}
          >
            {statusLabel(item.status)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatWhen(item.sent_at)}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span>from</span>
          {senderName ? (
            <span className={pageTitleColorClassName}>{senderName}</span>
          ) : null}
          {workState ? (
            <span className="inline-flex items-center gap-1">
              out of
              <StateIcon
                state={workState}
                className="size-5 shrink-0 text-brand"
                aria-label={workStateLabel ?? workState}
              />
            </span>
          ) : null}
          {!senderName && !workState ? <span>Driver</span> : null}
          {driverId ? (
            <>
              <span aria-hidden>·</span>
              <span>
                Driver ID <DriverId>{driverId}</DriverId>
              </span>
            </>
          ) : null}
        </p>
        {item.note?.trim() ? (
          <p className="mt-1 line-clamp-2 text-sm text-foreground">
            {item.note.trim()}
          </p>
        ) : item.report_comment?.trim() ? (
          <p className="mt-1 line-clamp-2 text-sm text-foreground">
            {item.report_comment.trim()}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
