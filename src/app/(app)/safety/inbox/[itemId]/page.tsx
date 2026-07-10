import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReportPhotoGallery } from "@/components/feed/report-photo-gallery";
import { BackLink } from "@/components/nav/back-link";
import { InboxStatusActions } from "@/components/safety/inbox-status-actions";
import { DriverId } from "@/components/ui/driver-id";
import { LocationLink } from "@/components/ui/location-link";
import { pageTitleClassName } from "@/components/ui/page-title";
import {
  canAccessSafetyInbox,
  getSessionProfile,
} from "@/lib/auth/profile";
import { damagePhotoUrl } from "@/lib/damage-photo";
import { createClient } from "@/lib/supabase/server";
import type {
  DamageReport,
  DamageReportPhoto,
  Profile,
  SafetyInboxItem,
} from "@/types/database";

type PageProps = {
  params: Promise<{ itemId: string }>;
};

function assetLabel(type: DamageReport["asset_type"]) {
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

export async function generateMetadata({ params }: PageProps) {
  const { itemId } = await params;
  return { title: `Inbox · ${itemId.slice(0, 8)}` };
}

export default async function SafetyInboxDetailPage({ params }: PageProps) {
  const session = await getSessionProfile();
  if (!session || !canAccessSafetyInbox(session.role)) {
    redirect("/profile");
  }

  const { itemId } = await params;
  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("safety_inbox_items")
    .select(
      "id, damage_report_id, sent_by, sent_at, status, note, reviewed_at, reviewed_by",
    )
    .eq("id", itemId)
    .maybeSingle();

  if (itemError || !item) notFound();

  const inbox = item as SafetyInboxItem;

  const [{ data: report }, { data: photoRows }] = await Promise.all([
    supabase
      .from("damage_reports")
      .select("*")
      .eq("id", inbox.damage_report_id)
      .maybeSingle(),
    supabase
      .from("damage_report_photos")
      .select("id, damage_report_id, r2_key, r2_url, sort_order, created_at")
      .eq("damage_report_id", inbox.damage_report_id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!report) notFound();

  const row = report as DamageReport;

  const { data: reporter } = await supabase
    .from("profiles")
    .select("id, full_name, driver_id")
    .eq("id", row.reported_by)
    .maybeSingle();
  const reporterProfile = reporter as Pick<
    Profile,
    "id" | "full_name" | "driver_id"
  > | null;

  const gallery = (photoRows ?? []) as DamageReportPhoto[];
  const photoUrls =
    gallery.length > 0
      ? gallery
          .map((p) => damagePhotoUrl(p.r2_url, p.r2_key))
          .filter((u): u is string => Boolean(u))
      : (() => {
          const cover = damagePhotoUrl(row.r2_url, row.r2_key);
          return cover ? [cover] : [];
        })();
  const isSafetyViewer = session.role === "safety";
  const reportDriverId =
    row.driver_id ?? reporterProfile?.driver_id ?? null;
  const reporterName = reporterProfile?.full_name?.trim() || null;

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-8 pt-4">
      <BackLink href="/safety/inbox" aria-label="Back to Feed">
        Feed
      </BackLink>

      <header className="mt-4">
        <h1 className={pageTitleClassName}>
          {assetLabel(row.asset_type)} {row.asset_number}
        </h1>
      </header>

      {photoUrls.length > 0 ? (
        <ReportPhotoGallery
          urls={photoUrls}
          altPrefix={`${assetLabel(row.asset_type)} ${row.asset_number} damage`}
        />
      ) : (
        <div className="mt-4 flex h-48 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          Photo unavailable
        </div>
      )}

      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Captured</dt>
          <dd className="font-medium">{formatWhen(row.captured_at)}</dd>
        </div>
        {reporterName ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Reported by</dt>
            <dd className="font-medium">{reporterName}</dd>
          </div>
        ) : null}
        {reportDriverId ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Driver ID</dt>
            <dd>
              <DriverId>{reportDriverId}</DriverId>
            </dd>
          </div>
        ) : null}
        {row.route_number ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Route</dt>
            <dd className="font-medium">{row.route_number}</dd>
          </div>
        ) : null}
        {row.latitude != null && row.longitude != null ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Location</dt>
            <dd>
              <LocationLink
                latitude={row.latitude}
                longitude={row.longitude}
                empty="hide"
              />
            </dd>
          </div>
        ) : null}
      </dl>

      {inbox.note?.trim() ? (
        <section className="mt-4">
          <h2 className="text-sm font-medium text-muted-foreground">Report note</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {inbox.note.trim()}
          </p>
        </section>
      ) : null}

      {row.report_comment?.trim() ? (
        <section className="mt-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Reported Damage or Issue
          </h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {row.report_comment.trim()}
          </p>
        </section>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        <InboxStatusActions itemId={inbox.id} status={inbox.status} />
        {!isSafetyViewer ? (
          <Link
            href={`/feed/${row.id}`}
            className="min-h-11 rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium text-foreground"
          >
            Open in Feed
          </Link>
        ) : (
          <Link
            href={`/export?reportId=${encodeURIComponent(row.id)}&autodownload=1`}
            className="min-h-11 rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium text-foreground"
          >
            Report Export
          </Link>
        )}
      </div>
    </main>
  );
}
