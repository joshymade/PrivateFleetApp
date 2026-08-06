import Link from "next/link";
import { Eye, ThumbsUp } from "lucide-react";
import { StateIcon } from "@/components/icons";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";
import { LocationLink } from "@/components/ui/location-link";
import { pageTitleColorClassName } from "@/components/ui/page-title";
import { feedUnitHref } from "@/lib/feed/asset-number";
import {
  safetyInboxStatusClassName,
  safetyInboxStatusLabel,
} from "@/lib/feed/safety-status";
import {
  feedReportAssetLabel,
  isTypedTrailerNumber,
} from "@/lib/feed/trailer-unit-type";
import { truncateFeedDescription } from "@/lib/feed/truncate";
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
  /**
   * From `safety_inbox_items.status` when the viewer can read the referral
   * (sender / safety / admin); otherwise null → “safety not notified”.
   */
  safety_inbox_status: SafetyInboxStatus | null;
};

export function FeedReportCard({ item }: { item: FeedListItem }) {
  const rawSnippet = item.report_comment?.trim();
  const snippet = rawSnippet
    ? truncateFeedDescription(rawSnippet)
    : null;
  const reporterName = displayFirstOrFull(item.reporter_full_name, "");
  const workState = item.reporter_work_state?.trim() || null;
  const workStateLabel = workState ? usStateName(workState) : null;
  const safetyLabel = safetyInboxStatusLabel(item.safety_inbox_status);
  const safetyLabelClass = safetyInboxStatusClassName(
    item.safety_inbox_status,
  );
  const typeLabel = feedReportAssetLabel(item.asset_type, item.asset_number);
  const numberClass =
    item.asset_type === "tractor"
      ? "font-bold text-brand"
      : isTypedTrailerNumber(item.asset_type, item.asset_number)
        ? `font-bold ${pageTitleColorClassName}`
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
          <p className="text-sm font-semibold tracking-tight text-foreground">
            <Link href={`/feed/${item.id}`} className="hover:underline">
              {typeLabel}
            </Link>{" "}
            <Link
              href={feedUnitHref(item.asset_number)}
              className={`${numberClass} hover:underline`}
              title={`All damage reports for ${item.asset_number}`}
            >
              {item.asset_number}
            </Link>
          </p>

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
            <span>{formatFeedTimestamp(item.captured_at)}</span>
            <span aria-hidden>|</span>
            <LocationLink
              latitude={item.latitude}
              longitude={item.longitude}
            />
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

          <p className="text-xs font-medium">
            {item.safety_inbox_status === "pending" ? (
              <ClickableTooltip
                ariaLabel="Safety Notified: learn more"
                className={safetyLabelClass}
                content="This damage report was submitted to the Safety Team by the reporting driver."
              >
                {safetyLabel}
              </ClickableTooltip>
            ) : (
              <span className={safetyLabelClass}>{safetyLabel}</span>
            )}
          </p>

          {snippet ? (
            <p className="text-sm text-foreground">{snippet}</p>
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
