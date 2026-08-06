import { ExportForm } from "@/components/export/export-form";
import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";
import { damagePhotoUrl } from "@/lib/damage-photo";
import { displayFirstOrFull } from "@/lib/profile-name";
import { createClient } from "@/lib/supabase/server";
import type {
  AssetType,
  DamageReport,
  DamageReportPhoto,
} from "@/types/database";

export const metadata = {
  title: "Report Export",
};

type PageProps = {
  searchParams: Promise<{ reportId?: string; autodownload?: string }>;
};

type ReportRow = Pick<
  DamageReport,
  | "id"
  | "asset_type"
  | "asset_number"
  | "driver_id"
  | "reported_by"
  | "captured_at"
  | "latitude"
  | "longitude"
  | "route_number"
  | "report_comment"
  | "damage_locations"
  | "r2_key"
  | "r2_url"
> & {
  damage_report_photos?: Pick<
    DamageReportPhoto,
    "id" | "r2_key" | "r2_url" | "sort_order" | "damage_location"
  >[] | null;
};

type ReporterProfile = {
  id: string;
  full_name: string | null;
  work_state: string | null;
  driver_id: string | null;
};

export default async function ExportPage({ searchParams }: PageProps) {
  const { reportId: reportIdParam, autodownload: autodownloadParam } =
    await searchParams;
  const initialReportId = reportIdParam?.trim() || null;
  const autoDownload =
    autodownloadParam === "1" || autodownloadParam === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-lg p-6">
        <h1 className={pageTitleClassName}>Report Export</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to export reports.
        </p>
      </main>
    );
  }

  const reportSelect =
    "id, asset_type, asset_number, driver_id, reported_by, captured_at, latitude, longitude, route_number, report_comment, damage_locations, r2_key, r2_url, damage_report_photos(id, r2_key, r2_url, sort_order, damage_location)";

  const { data, error } = await supabase
    .from("damage_reports")
    .select(reportSelect)
    .order("captured_at", { ascending: false })
    .limit(40);

  let rows = (data ?? []) as ReportRow[];

  // Deep-link may target a report outside the latest-40 window.
  if (
    initialReportId &&
    !rows.some((r) => r.id === initialReportId)
  ) {
    const { data: linked } = await supabase
      .from("damage_reports")
      .select(reportSelect)
      .eq("id", initialReportId)
      .maybeSingle();
    if (linked) {
      rows = [linked as ReportRow, ...rows];
    }
  }

  const reporterIds = [...new Set(rows.map((r) => r.reported_by))];
  const { data: reporters } =
    reporterIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, work_state, driver_id")
          .in("id", reporterIds)
      : { data: [] as ReporterProfile[] };

  const reporterById = new Map(
    (reporters ?? []).map((p) => [
      p.id as string,
      {
        full_name: (p.full_name as string | null) ?? null,
        work_state: (p.work_state as string | null) ?? null,
        driver_id: (p.driver_id as string | null) ?? null,
      },
    ]),
  );

  function toExportOption(r: ReportRow) {
    const childPhotos = [...(r.damage_report_photos ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const photos =
      childPhotos.length > 0
        ? childPhotos.map((p) => ({
            r2_key: p.r2_key,
            photo_url: damagePhotoUrl(p.r2_url, p.r2_key),
            sort_order: p.sort_order,
            damage_location: p.damage_location ?? null,
          }))
        : r.r2_key
          ? [
              {
                r2_key: r.r2_key,
                photo_url: damagePhotoUrl(r.r2_url, r.r2_key),
                sort_order: 0,
                damage_location: null as string | null,
              },
            ]
          : [];

    const reporter = reporterById.get(r.reported_by);
    const displayName = displayFirstOrFull(reporter?.full_name, "");

    return {
      id: r.id,
      asset_type: r.asset_type as AssetType,
      asset_number: r.asset_number,
      reporter_display_name: displayName || null,
      reporter_work_state: reporter?.work_state?.trim() || null,
      // Prefer capture-time snapshot; fall back to current profile driver_id.
      driver_id: r.driver_id ?? reporter?.driver_id ?? null,
      captured_at: r.captured_at,
      latitude: r.latitude,
      longitude: r.longitude,
      route_number: r.route_number,
      report_comment: r.report_comment,
      damage_locations: r.damage_locations ?? [],
      photos,
    };
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-8 pt-4">
      <BackLink href="/account" aria-label="Back to Account">
        Account
      </BackLink>
      <h1 className={`mt-2 ${pageTitleClassName}`}>Report Export</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Download each photo on a report as a JPG with a white metadata strip.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600">{error.message}</p>
      ) : (
        <div className="mt-6">
          <ExportForm
            initialReportId={initialReportId}
            autoDownload={autoDownload}
            reports={rows.map(toExportOption)}
          />
        </div>
      )}
    </main>
  );
}
