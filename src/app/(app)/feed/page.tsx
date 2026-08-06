import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FeedPagination } from "@/components/feed/feed-pagination";
import { FeedReportCard } from "@/components/feed/feed-report-card";
import { FeedSearch } from "@/components/feed/feed-search";
import {
  FeedWeekCards,
  type FeedWeekCardItem,
} from "@/components/feed/feed-week-cards";
import { pageTitleClassName } from "@/components/ui/page-title";
import { damagePhotoUrl } from "@/lib/damage-photo";
import {
  assetNumberDigits,
  feedUnitHref,
} from "@/lib/feed/asset-number";
import {
  currentIsoWeek,
  formatIsoWeekKey,
  isoWeekPartsFromIso,
  isoWeekRangeUtc,
  parseIsoWeekKey,
  shiftIsoWeek,
} from "@/lib/feed/iso-week";
import { createClient } from "@/lib/supabase/server";
import type {
  AssetType,
  DamageReportWithNoticeCount,
  SafetyInboxStatus,
  UserRole,
} from "@/types/database";

export const metadata = {
  title: "Fleet Damage Feed",
};

const PAGE_SIZE = 20;
/** Look back this many weeks (plus current) for week cards. */
const WEEK_LOOKBACK = 15;

type FeedPageProps = {
  searchParams: Promise<{ q?: string; week?: string; page?: string }>;
};

type ReportRow = Pick<
  DamageReportWithNoticeCount,
  | "id"
  | "asset_type"
  | "asset_number"
  | "driver_id"
  | "reported_by"
  | "report_comment"
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

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const queryRaw = params.q?.trim() ?? "";
  const queryDigits = assetNumberDigits(queryRaw);
  // Unit search opens the dedicated unit history page (digit-normalized).
  if (queryDigits) {
    redirect(feedUnitHref(queryDigits));
  }
  const weekParam = params.week?.trim() ?? "";
  const selectedWeekParts = weekParam ? parseIsoWeekKey(weekParam) : null;
  const selectedWeekKey = selectedWeekParts
    ? formatIsoWeekKey(selectedWeekParts)
    : null;
  const requestedPage = parsePage(params.page);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-lg p-6">
        <h1 className={pageTitleClassName}>Fleet Damage Feed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to view the latest damage reports.
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
  // Safety uses the referred-inbox Feed, not the full fleet feed.
  if (viewerRole === "safety") {
    redirect("/safety/inbox");
  }

  const now = new Date();
  const currentWeek = currentIsoWeek(now);
  const currentWeekKey = formatIsoWeekKey(currentWeek);
  const lookbackStart = shiftIsoWeek(currentWeek, -WEEK_LOOKBACK);
  const { startIso: lookbackStartIso } = isoWeekRangeUtc(lookbackStart);

  const weekCountsQuery = supabase
    .from("damage_reports_with_notice_count")
    .select("captured_at")
    .gte("captured_at", lookbackStartIso)
    .order("captured_at", { ascending: false });

  let countQuery = supabase
    .from("damage_reports_with_notice_count")
    .select("id", { count: "exact", head: true });

  if (selectedWeekParts) {
    const { startIso, endIso } = isoWeekRangeUtc(selectedWeekParts);
    countQuery = countQuery.gte("captured_at", startIso).lt("captured_at", endIso);
  }

  const [{ count: totalCountRaw }, { data: weekCapturedAt, error: weekError }] =
    await Promise.all([countQuery, weekCountsQuery]);

  const totalCount = totalCountRaw ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let reportsQuery = supabase
    .from("damage_reports_with_notice_count")
    .select(
      "id, asset_type, asset_number, driver_id, reported_by, report_comment, captured_at, latitude, longitude, r2_key, r2_url, notice_count, view_count",
    )
    .order("captured_at", { ascending: false })
    .range(from, to);

  if (selectedWeekParts) {
    const { startIso, endIso } = isoWeekRangeUtc(selectedWeekParts);
    reportsQuery = reportsQuery
      .gte("captured_at", startIso)
      .lt("captured_at", endIso);
  }

  const { data, error } = await reportsQuery;

  const countByWeek = new Map<string, number>();
  for (const row of weekCapturedAt ?? []) {
    const parts = isoWeekPartsFromIso(row.captured_at as string);
    if (!parts) continue;
    const key = formatIsoWeekKey(parts);
    countByWeek.set(key, (countByWeek.get(key) ?? 0) + 1);
  }

  // Contiguous lookback including empty weeks (0 reports still shown / clickable).
  const weekCards: FeedWeekCardItem[] = [];
  for (let i = 0; i <= WEEK_LOOKBACK; i++) {
    const parts = shiftIsoWeek(currentWeek, -i);
    const key = formatIsoWeekKey(parts);
    weekCards.push({
      key,
      week: parts.week,
      year: parts.year,
      count: countByWeek.get(key) ?? 0,
      isCurrent: key === currentWeekKey,
    });
  }
  // Chronological left→right (oldest → newest) so current week is at the end
  weekCards.reverse();

  if (
    selectedWeekKey &&
    selectedWeekParts &&
    !weekCards.some((w) => w.key === selectedWeekKey)
  ) {
    weekCards.unshift({
      key: selectedWeekKey,
      week: selectedWeekParts.week,
      year: selectedWeekParts.year,
      count: totalCount,
      isCurrent: selectedWeekKey === currentWeekKey,
    });
  }

  const rows = (data ?? []) as ReportRow[];

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
      // RLS: sender (and safety/admin) can read referral status for the tag.
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
      inboxStatusByReportId.set(
        reportId,
        row.status as SafetyInboxStatus,
      );
    }
  }

  const listError = error ?? weekError;

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 pb-6 pt-3">
      <header>
        <h1 className={pageTitleClassName}>Fleet Damage Feed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time damage reports submitted by our private fleet drivers.
          Search a trailer/tractor unit here before tagging new defects.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="min-h-12 rounded-xl border border-brand/40 bg-card shadow-sm" />
        }
      >
        <FeedSearch />
      </Suspense>

      <FeedWeekCards
        weeks={weekCards}
        selectedWeek={selectedWeekKey}
        query=""
        currentYear={currentWeek.year}
      />

      {listError ? (
        <p className="text-sm text-destructive">{listError.message}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {selectedWeekKey
            ? "No damage reports for this week."
            : "All clear! No recent damage reports found for the fleet today."}
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
        week={selectedWeekKey}
      />
    </main>
  );
}
