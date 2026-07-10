import Link from "next/link";
import { Eye, ThumbsUp } from "lucide-react";
import { StateIcon } from "@/components/icons";
import { LocationLink } from "@/components/ui/location-link";
import { pageTitleColorClassName } from "@/components/ui/page-title";
import { safetyInboxStatusLabel } from "@/lib/feed/safety-status";
import { formatFeedTimestamp } from "@/lib/format-time";
import { displayFirstOrFull } from "@/lib/profile-name";
import { usStateName } from "@/lib/us-states";
import type { AssetType, SafetyInboxStatus } from "@/types/database";

export type FeedListItem = {
  id: string;
  asset_type: AssetType;
  asset_number: string;
  report_comment: string | null;
  captured_at: string;
  r2_url: string | null;
  photo_url: string | null;
  notice_count: number;
  noticed_by_me: boolean;
  view_count: number;
  latitude: number | null;
  longitude: number | null;
  reporter_full_name: string | null;
  reporter_work_state: string | null;
  /** Present when the viewer can read the referral (sender / safety / admin). */
  safety_inbox_status: SafetyInboxStatus | null;
};

function assetLabel(type: AssetType) {
  return type === "tractor" ? "Tractor" : "Trailer";
}

export function FeedReportCard({ item }: { item: FeedListItem }) {
  const snippet = item.report_comment?.trim();
  const reporterName = displayFirstOrFull(item.reporter_full_name, "");
  const workState = item.reporter_work_state?.trim() || null;
  const workStateLabel = workState ? usStateName(workState) : null;
  const safetyLabel = safetyInboxStatusLabel(item.safety_inbox_status);
  const numberClass =
    item.asset_type === "tractor"
      ? "font-bold text-brand"
      : "font-bold text-accent";

  return (
    <article className="border-b border-border py-4 last:border-b-0">
      <div className="flex gap-3">
        <Link
          href={`/feed/${item.id}`}
          className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted"
        >
          {item.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- R2 public URLs; avoid remotePatterns churn
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
        </Link>

        <div className="min-w-0 flex-1 space-y-1.5">
          <Link href={`/feed/${item.id}`} className="block">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {assetLabel(item.asset_type)}{" "}
              <span className={numberClass}>{item.asset_number}</span>
            </p>
          </Link>

          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <span>Reported by:</span>
            {reporterName ? (
              <span className={pageTitleColorClassName}>{reporterName}</span>
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
            {!reporterName && !workState ? <span>—</span> : null}
          </p>

          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <LocationLink
              latitude={item.latitude}
              longitude={item.longitude}
            />
            <span aria-hidden>|</span>
            <span>{formatFeedTimestamp(item.captured_at)}</span>
            <span aria-hidden>|</span>
            <span
              className="inline-flex items-center gap-1"
              title={`${item.view_count} view${item.view_count === 1 ? "" : "s"}`}
            >
              <Eye className="size-3.5 shrink-0" aria-hidden />
              <span>{item.view_count}</span>
              <span className="sr-only">
                {item.view_count === 1 ? "view" : "views"}
              </span>
            </span>
            {item.notice_count > 0 ? (
              <>
                <span aria-hidden>|</span>
                <span
                  className="inline-flex items-center gap-1 text-accent"
                  title={`${item.notice_count} noticed`}
                >
                  <ThumbsUp className="size-3.5 shrink-0" aria-hidden />
                  <span>{item.notice_count}</span>
                  <span className="sr-only">noticed</span>
                </span>
              </>
            ) : null}
          </p>

          {safetyLabel ? (
            <p className="text-xs font-medium text-muted-foreground">
              {safetyLabel}
            </p>
          ) : null}

          {snippet ? (
            <p className="line-clamp-2 text-sm text-foreground">{snippet}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <Link
          href={`/feed/${item.id}`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors dark:border dark:border-foreground/40 dark:bg-transparent dark:text-foreground"
        >
          View Damage
        </Link>
      </div>
    </article>
  );
}
