import { redirect } from "next/navigation";
import { DamageCaptureForm } from "@/components/damage/damage-capture-form";
import {
  canAccessReport,
  driverNeedsProfileSetup,
  getSessionProfile,
  PROFILE_SETUP_PATH,
} from "@/lib/auth/profile";
import { resolveCurrentTrailerForDamage } from "@/lib/loads/format";
import { getActiveLoadForDriver } from "@/lib/loads/queries";
import { formatTractorNumber } from "@/lib/tractor-number";
import type { AssetType } from "@/types/database";

type ReportPageProps = {
  searchParams?: Promise<{ submitted?: string; type?: string }>;
};

function parseAssetType(raw: string | undefined): AssetType | undefined {
  if (raw === "tractor" || raw === "trailer") return raw;
  return undefined;
}

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const session = await getSessionProfile();
  if (!session || !canAccessReport(session.role)) {
    redirect("/home");
  }
  if (driverNeedsProfileSetup(session.role, session.profile)) {
    redirect(PROFILE_SETUP_PATH);
  }

  const params = searchParams ? await searchParams : {};
  const submittedId = params.submitted;
  const initialAssetType = parseAssetType(params.type);

  const activeLoad = await getActiveLoadForDriver(session.userId);
  const truckRaw =
    activeLoad?.truck_number?.trim() ||
    session.profile?.current_truck_number?.trim() ||
    null;
  const trailerRaw = activeLoad
    ? resolveCurrentTrailerForDamage(
        activeLoad.load_stops,
        activeLoad.trailer_number,
      )
    : null;

  const activeUnit =
    activeLoad && (truckRaw || trailerRaw)
      ? {
          loadId: activeLoad.id,
          truckNumber: truckRaw ? formatTractorNumber(truckRaw) : null,
          trailerNumber: trailerRaw,
          routeNumber: activeLoad.route_number?.trim() || null,
        }
      : null;

  return (
    <DamageCaptureForm
      key={`${submittedId ?? "new"}-${initialAssetType ?? "tractor"}`}
      initialAssetType={initialAssetType}
      submittedId={submittedId}
      activeUnit={activeUnit}
    />
  );
}
