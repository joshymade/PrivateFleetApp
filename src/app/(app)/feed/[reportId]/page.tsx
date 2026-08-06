import Link from "next/link";
import { Eye, ThumbsUp } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { DeleteReportButton } from "@/components/feed/delete-report-button";
import { NoticeButton } from "@/components/feed/notice-button";
import { ReplyThread, type FeedReply } from "@/components/feed/reply-thread";
import { ReportPhotoGallery } from "@/components/feed/report-photo-gallery";
import { ReportPrivacyActions } from "@/components/feed/report-privacy-actions";
import { ReportViewTracker } from "@/components/feed/report-view-tracker";
import { SendToSafetyButton } from "@/components/feed/send-to-safety-button";
import { StateIcon } from "@/components/icons";
import { BackLink } from "@/components/nav/back-link";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";
import { DriverId } from "@/components/ui/driver-id";
import { LocationLink } from "@/components/ui/location-link";
import {
  pageTitleClassName,
  pageTitleColorClassName,
} from "@/components/ui/page-title";
import { canViewDriverId } from "@/lib/auth/driver-id-visibility";
import { isAnonymousReporter } from "@/lib/damage/anonymous";
import {
  formatDamageLocationLabels,
} from "@/lib/damage/locations";
import { damagePhotoUrl } from "@/lib/damage-photo";
import { feedUnitHref } from "@/lib/feed/asset-number";
import {
  safetyInboxStatusClassName,
  safetyInboxStatusLabel,
} from "@/lib/feed/safety-status";
import {
  feedReportAssetLabel,
  feedUnitNumberClassName,
  isTypedTrailerNumber,
} from "@/lib/feed/trailer-unit-type";
import { truncateFeedDescription } from "@/lib/feed/truncate";
import { formatFeedTimestamp } from "@/lib/format-time";
import { displayFirstOrFull } from "@/lib/profile-name";
import { createClient } from "@/lib/supabase/server";
import { usStateName } from "@/lib/us-states";
import type {
  DamageReport,
  DamageReportComment,
  DamageReportPhoto,
  Profile,
  SafetyInboxStatus,
  UserRole,
} from "@/types/database";

type PageProps = {
  params: Promise<{ reportId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { reportId } = await params;
  return { title: `Report · ${reportId.slice(0, 8)}` };
}

export default async function FeedReportDetailPage({ params }: PageProps) {
  const { reportId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-lg p-6">
        <BackLink href="/feed" aria-label="Back to Feed">
          Feed
        </BackLink>
        <p className="mt-4 text-sm text-muted-foreground">
          Sign in to view this report.
        </p>
      </main>
    );
  }

  const { data: report, error: reportError } = await supabase
    .from("damage_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (reportError || !report) notFound();

  const row = report as DamageReport;
  const viewCount = row.view_count ?? 0;

  const [
    { data: notices },
    { data: comments },
    { data: profile },
    { data: reporterProfile },
    { data: inboxReferral },
    { data: photoRows },
    { data: pendingDeletion },
  ] = await Promise.all([
    supabase
      .from("damage_notices")
      .select("id, noticed_by, noticed_at")
      .eq("damage_report_id", reportId),
    // Comments are not shown to Safety; skip the fetch when possible after role load.
    supabase
      .from("damage_report_comments")
      .select(
        "id, damage_report_id, author_id, parent_id, body, created_at, damage_report_comment_beeps(user_id)",
      )
      .eq("damage_report_id", reportId)
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, role, full_name, driver_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, full_name, work_state, driver_id, is_system_anonymous")
      .eq("id", row.reported_by)
      .maybeSingle(),
    supabase
      .from("safety_inbox_items")
      .select("id, status")
      .eq("damage_report_id", reportId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("damage_report_photos")
      .select("id, damage_report_id, r2_key, r2_url, sort_order, damage_location, created_at")
      .eq("damage_report_id", reportId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("report_deletion_requests")
      .select("id")
      .eq("damage_report_id", reportId)
      .eq("requested_by", user.id)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  const roleEarly = (profile?.role as UserRole | undefined) ?? "driver";
  // Safety may only open referred reports; prefer inbox detail when available.
  if (roleEarly === "safety") {
    if (!inboxReferral) notFound();
    redirect(`/safety/inbox/${inboxReferral.id}`);
  }

  const gallery = (photoRows ?? []) as DamageReportPhoto[];
  const galleryPhotos =
    gallery.length > 0
      ? gallery
          .map((p) => {
            const url = damagePhotoUrl(p.r2_url, p.r2_key);
            if (!url) return null;
            return {
              url,
              damageLocation: p.damage_location ?? null,
            };
          })
          .filter((p): p is { url: string; damageLocation: string | null } =>
            Boolean(p),
          )
      : (() => {
          const cover = damagePhotoUrl(row.r2_url, row.r2_key);
          return cover
            ? [{ url: cover, damageLocation: null as string | null }]
            : [];
        })();

  const noticeRows = notices ?? [];
  const noticedByMe = noticeRows.some((n) => n.noticed_by === user.id);
  const noticeCount = noticeRows.length;

  type CommentRow = DamageReportComment & {
    damage_report_comment_beeps?: { user_id: string }[] | null;
  };
  const commentRows = (comments ?? []) as CommentRow[];
  const authorIds = [...new Set(commentRows.map((c) => c.author_id))];
  let authorsById = new Map<
    string,
    Pick<Profile, "full_name" | "work_state" | "driver_id">
  >();

  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, full_name, work_state, driver_id")
      .in("id", authorIds);
    authorsById = new Map(
      (authors ?? []).map((a) => [
        a.id as string,
        {
          full_name: (a.full_name as string | null) ?? null,
          work_state: (a.work_state as string | null) ?? null,
          driver_id: (a.driver_id as string | null) ?? null,
        },
      ]),
    );
  }

  const role = (profile?.role as UserRole | undefined) ?? "driver";
  const isAdmin = role === "admin";
  const isSafety = role === "safety";
  const isOwnReport = row.reported_by === user.id;
  const isOriginalReporter =
    (row.original_reported_by ?? row.reported_by) === user.id;
  const reportIsAnonymous =
    isAnonymousReporter(row.reported_by) ||
    Boolean(
      (reporterProfile as { is_system_anonymous?: boolean } | null)
        ?.is_system_anonymous,
    );
  const canUntag =
    role === "driver" && isOriginalReporter && isOwnReport && !reportIsAnonymous;
  const hasPendingDeletionRequest = Boolean(pendingDeletion);
  const canRequestDeletion =
    role === "driver" &&
    isOriginalReporter &&
    reportIsAnonymous &&
    !hasPendingDeletionRequest;
  const showComments = !isSafety;
  const showNotice = !isSafety && !isOwnReport;
  const feedBackHref = isSafety ? "/safety/inbox" : "/feed";
  const showReportDriverId =
    !reportIsAnonymous &&
    canViewDriverId({
      viewerRole: role,
      viewerUserId: user.id,
      subjectUserId: row.reported_by,
    });
  const reportDriverId = showReportDriverId
    ? (row.driver_id ??
      (reporterProfile?.driver_id as string | null | undefined) ??
      null)
    : null;

  const replies: FeedReply[] = showComments
    ? commentRows.map((c) => {
        const author = authorsById.get(c.author_id);
        const showAuthorDriverId = canViewDriverId({
          viewerRole: role,
          viewerUserId: user.id,
          subjectUserId: c.author_id,
        });
        const beeps = c.damage_report_comment_beeps ?? [];
        return {
          id: c.id,
          damage_report_id: c.damage_report_id,
          author_id: c.author_id,
          parent_id: c.parent_id,
          body: c.body,
          created_at: c.created_at,
          author_name: author?.full_name ?? null,
          author_work_state: author?.work_state ?? null,
          author_driver_id: showAuthorDriverId
            ? (author?.driver_id ?? null)
            : null,
          beep_count: beeps.length,
          beeped_by_me: beeps.some((b) => b.user_id === user.id),
        };
      })
    : [];

  const reporterName = reportIsAnonymous
    ? "Anonymous Driver"
    : displayFirstOrFull(
        (reporterProfile?.full_name as string | null | undefined) ?? null,
        "",
      );
  const workState = reportIsAnonymous
    ? null
    : ((reporterProfile?.work_state as string | null | undefined) ?? "").trim() ||
      null;
  const workStateLabel = workState ? usStateName(workState) : null;

  const hasLocation = row.latitude != null && row.longitude != null;
  const inboxStatus =
    (inboxReferral?.status as SafetyInboxStatus | undefined) ?? null;
  const safetyStatusLabel = safetyInboxStatusLabel(inboxStatus);
  const safetyStatusClass = safetyInboxStatusClassName(inboxStatus);
  const typeLabel = feedReportAssetLabel(row.asset_type, row.asset_number);
  const typedTrailer = isTypedTrailerNumber(row.asset_type, row.asset_number);
  const numberClass = `${feedUnitNumberClassName} hover:underline`;

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-8 pt-4">
      <ReportViewTracker reportId={row.id} />
      <BackLink href={feedBackHref} aria-label="Back to Feed">
        Feed
      </BackLink>

      <header className="mt-4">
        <h1
          className={
            typedTrailer
              ? "text-2xl font-semibold tracking-tight text-foreground"
              : pageTitleClassName
          }
        >
          {typeLabel}{" "}
          <Link
            href={feedUnitHref(row.asset_number)}
            className={numberClass}
            title={`All damage reports for ${row.asset_number}`}
          >
            {row.asset_number}
          </Link>
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
          <time dateTime={row.captured_at}>
            {formatFeedTimestamp(row.captured_at)}
          </time>
          <span aria-hidden>·</span>
          <span
            className="inline-flex items-center gap-1"
            title={`${viewCount} view${viewCount === 1 ? "" : "s"}`}
          >
            <Eye className="size-3.5 shrink-0" aria-hidden />
            <span>{viewCount}</span>
            <span className="sr-only">
              {viewCount === 1 ? "view" : "views"}
            </span>
          </span>
          {reporterName || workState ? (
            <>
              <span aria-hidden>·</span>
              <span>Reported by</span>
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
            </>
          ) : null}
          {reportDriverId ? (
            <>
              <span aria-hidden>·</span>
              <span>
                Driver <DriverId>{reportDriverId}</DriverId>
              </span>
            </>
          ) : null}
        </p>
      </header>

      {galleryPhotos.length > 0 ? (
        <ReportPhotoGallery
          photos={galleryPhotos}
          altPrefix={`${typeLabel} ${row.asset_number} damage`}
        />
      ) : (
        <div className="mt-4 flex h-48 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          Photo unavailable
        </div>
      )}

      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="flex flex-col gap-1 text-muted-foreground">
            {inboxStatus === "pending" ? (
              <ClickableTooltip
                ariaLabel="Safety Notified: learn more"
                className={safetyStatusClass}
                content="This damage report was submitted to the Safety Team by the reporting driver."
              >
                {safetyStatusLabel}
              </ClickableTooltip>
            ) : (
              <span className={safetyStatusClass}>{safetyStatusLabel}</span>
            )}
            {noticeCount > 0 ? (
              <span
                className="inline-flex items-center gap-1"
                title={`${noticeCount} noticed`}
              >
                <ThumbsUp className="size-3.5 shrink-0" aria-hidden />
                <span>{noticeCount}</span>
                <span className="sr-only">noticed</span>
              </span>
            ) : null}
          </dt>
          <dd>
            {hasLocation ? (
              <LocationLink
                latitude={row.latitude}
                longitude={row.longitude}
                empty="hide"
              />
            ) : null}
          </dd>
        </div>
      </dl>

      {row.report_comment?.trim() ? (
        <section className="mt-4">
          <h2 className="text-sm font-medium text-muted-foreground">Reported Damage or Issue</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {truncateFeedDescription(row.report_comment.trim())}
          </p>
        </section>
      ) : null}

      {(() => {
        const locationLabels = formatDamageLocationLabels(row.damage_locations);
        if (locationLabels.length === 0) return null;
        return (
          <section className="mt-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              Damage location
            </h2>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {locationLabels.map((label) => (
                <li
                  key={label}
                  className="rounded-lg border border-border bg-card px-3 py-2.5 text-center text-sm font-medium text-foreground"
                >
                  {label}
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      <div className="mt-6 flex flex-col gap-3">
        {showNotice ? (
          <NoticeButton
            reportId={row.id}
            noticedByMe={noticedByMe}
            noticeCount={noticeCount}
          />
        ) : null}
        {!isSafety ? (
          <SendToSafetyButton
            reportId={row.id}
            alreadySent={Boolean(inboxReferral)}
            isOwner={isOwnReport}
          />
        ) : null}
        <ReportPrivacyActions
          reportId={row.id}
          canUntag={canUntag}
          canRequestDeletion={canRequestDeletion}
          hasPendingDeletionRequest={hasPendingDeletionRequest}
        />
        <Link
          href={`/export?reportId=${encodeURIComponent(row.id)}&autodownload=1`}
          className="min-h-11 rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium text-foreground"
        >
          Save Report To Phone
        </Link>
        {isAdmin ? <DeleteReportButton reportId={row.id} /> : null}
      </div>

      {showComments ? (
        <div className="mt-8 border-t border-border pt-6">
          <ReplyThread
            reportId={row.id}
            currentUserId={user.id}
            isAdmin={isAdmin}
            replies={replies}
          />
        </div>
      ) : null}
    </main>
  );
}
