import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { FeedPagination } from "@/components/feed/feed-pagination";
import { FeedReportCard } from "@/components/feed/feed-report-card";
import { FeedSearch } from "@/components/feed/feed-search";
import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";
import { damagePhotoUrl } from "@/lib/damage-photo";
import {
  assetNumberDigits,
  assetNumberMatchValues,
  displayAssetNumberFromReports,
  feedUnitHref,
} from "@/lib/feed/asset-number";
import {
  feedReportAssetLabel,
  feedUnitNumberClassName,
  isTypedTrailerNumber,
  trailerUnitKindFromNumber,
  trailerUnitKindLabel,
} from "@/lib/feed/trailer-unit-type";
import { createClient } from "@/lib/supabase/server";
import type {
  AssetType,
  DamageReportWithNoticeCount,
  SafetyInboxStatus,
  UserRole,
} from "@/types/database";

const PAGE_SIZE = 20;

type PageProps = {
  params: Promise<{ assetNumber: string }>;
  searchParams: Promise<{ page?: string }>;
};

type ReportRow = Pick<
  DamageReportWithNoticeCount,
  | "id"
  | "asset_type"
  | "asset_number"
  | "driver_id"
  | "reported_by"
  | "report_comment"
  | "damage_locations"
  | "captured_at"
  | "latitude"
  | "longitude"
  | "r2_key"
  | "r2_url"
  | "notice_count"
  | "view_count"
>;

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export async function generateMetadata({ params }: PageProps) {
  const { assetNumber: raw } = await params;
  const digits = assetNumberDigits(decodeURIComponent(raw));
  return {
    title: digits ? `Unit ${digits} · Feed` : "Unit · Feed",
  };
}

export default async function FeedUnitPage({ params, searchParams }: PageProps) {
  const { assetNumber: rawParam } = await params;
  const { page: pageParam } = await searchParams;
  const decoded = decodeURIComponent(rawParam);
  const digits = assetNumberDigits(decoded);

  if (!digits) {
    redirect("/feed");
  }

  // Canonical slug is digits-only (preserves display format on the page itself).
  if (decoded !== digits) {
    const qs = pageParam ? `?page=${encodeURIComponent(pageParam)}` : "";
    redirect(`/feed/unit/${encodeURIComponent(digits)}${qs}`);
  }

  const requestedPage = parsePage(pageParam);
  const matchValues = assetNumberMatchValues(digits);

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
          Sign in to view damage reports for this unit.
        </p>
      </main>
    );
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const viewerRole = (viewerProfile?.role as UserRole | undefined) ?? "driver";
  if (viewerRole === "safety") {
    redirect("/safety/inbox");
  }

  const assetFilter = matchValues
    .map((v) => `asset_number.eq."${v.replace(/"/g, '\\"')}"`)
    .join(",");

  const { count: totalCountRaw } = await supabase
    .from("damage_reports_with_notice_count")
    .select("id", { count: "exact", head: true })
    .or(assetFilter);

  const totalCount = totalCountRaw ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from("damage_reports_with_notice_count")
    .select(
      "id, asset_type, asset_number, driver_id, reported_by, report_comment, damage_locations, captured_at, latitude, longitude, r2_key, r2_url, notice_count, view_count",
    )
    .or(assetFilter)
    .order("captured_at", { ascending: false })
    .range(from, to);

  const rows = (data ?? []) as ReportRow[];
  const displayNumber = displayAssetNumberFromReports(
    digits,
    rows.map((r) => r.asset_number),
  );
  const assetType = rows[0]?.asset_type as AssetType | undefined;
  const inferredKind =
    assetType == null ? trailerUnitKindFromNumber(displayNumber) : null;
  const typedTrailer =
    assetType != null
      ? isTypedTrailerNumber(assetType, displayNumber)
      : inferredKind != null;
  const typeLabel =
    assetType != null
      ? feedReportAssetLabel(assetType, displayNumber)
      : inferredKind
        ? trailerUnitKindLabel(inferredKind)
        : null;
  const numberClass = feedUnitNumberClassName;

  const reportIds = rows.map((r) => r.id);
  const reporterIds = [...new Set(rows.map((r) => r.reported_by))];

  const [{ data: myNotices }, { data: reporters }, { data: inboxRows }] =
    await Promise.all([
      reportIds.length > 0
        ? supabase
            .from("damage_notices")
            .select("damage_report_id")
            .eq("noticed_by", user.id)
            .in("damage_report_id", reportIds)
        : Promise.resolve({ data: [] as { damage_report_id: string }[] }),
      reporterIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, full_name, work_state")
            .in("id", reporterIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              full_name: string | null;
              work_state: string | null;
            }[],
          }),
      reportIds.length > 0
        ? supabase
            .from("safety_inbox_items")
            .select("damage_report_id, status")
            .in("damage_report_id", reportIds)
        : Promise.resolve({
            data: [] as { damage_report_id: string; status: string }[],
          }),
    ]);

  const noticedIds = new Set(
    (myNotices ?? []).map((n) => n.damage_report_id as string),
  );
  const reporterById = new Map(
    (reporters ?? []).map((p) => [
      p.id as string,
      {
        full_name: (p.full_name as string | null) ?? null,
        work_state: (p.work_state as string | null) ?? null,
      },
    ]),
  );
  const inboxStatusByReportId = new Map<string, SafetyInboxStatus>();
  for (const row of inboxRows ?? []) {
    const reportId = row.damage_report_id as string;
    if (!inboxStatusByReportId.has(reportId)) {
      inboxStatusByReportId.set(reportId, row.status as SafetyInboxStatus);
    }
  }

  if (matchValues.length === 0) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 pb-6 pt-3">
      <BackLink href="/feed" aria-label="Back to Feed">
        Feed
      </BackLink>

      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Feed
        </p>
        <h1
          className={
            typedTrailer
              ? "text-2xl font-semibold tracking-tight text-foreground"
              : pageTitleClassName
          }
        >
          {typeLabel ? (
            <>
              <span>{typeLabel} </span>
              <span className={numberClass}>{displayNumber}</span>
            </>
          ) : (
            <span className={numberClass}>{displayNumber}</span>
          )}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All damage reports for this{" "}
          {assetType === "tractor"
            ? "tractor"
            : assetType === "trailer" || inferredKind
              ? "trailer"
              : "unit"}
          .
        </p>
      </header>

      <Suspense
        fallback={
          <div className="min-h-12 rounded-xl border border-brand/40 bg-card shadow-sm" />
        }
      >
        <FeedSearch key={digits} initialQuery={displayNumber} />
      </Suspense>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          No damage reports for unit “{displayNumber}”.
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              <FeedReportCard
                item={{
                  id: row.id,
                  asset_type: row.asset_type as AssetType,
                  asset_number: row.asset_number,
                  report_comment: row.report_comment,
                  damage_locations: row.damage_locations,
                  captured_at: row.captured_at,
                  r2_url: row.r2_url,
                  photo_url: damagePhotoUrl(row.r2_url, row.r2_key),
                  notice_count: row.notice_count,
                  noticed_by_me: noticedIds.has(row.id),
                  view_count: row.view_count ?? 0,
                  latitude: row.latitude,
                  longitude: row.longitude,
                  reporter_full_name:
                    reporterById.get(row.reported_by)?.full_name ?? null,
                  reporter_work_state:
                    reporterById.get(row.reported_by)?.work_state ?? null,
                  safety_inbox_status:
                    inboxStatusByReportId.get(row.id) ?? null,
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <FeedPagination
        page={page}
        totalPages={totalCount === 0 ? 0 : totalPages}
        totalCount={totalCount}
        hrefForPage={(p) => feedUnitHref(digits, { page: p })}
      />
    </main>
  );
}
