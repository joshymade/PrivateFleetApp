import { redirect } from "next/navigation";
import { DamageCaptureForm } from "@/components/damage/damage-capture-form";
import {
  canAccessReport,
  driverNeedsProfileSetup,
  getSessionProfile,
  PROFILE_SETUP_PATH,
} from "@/lib/auth/profile";
import { getRecentLoadsForDriver } from "@/lib/loads/queries";
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
  const recentLoads = await getRecentLoadsForDriver(session.userId, 10);

  return (
    <DamageCaptureForm
      initialAssetType={initialAssetType}
      submittedId={submittedId}
      recentLoads={recentLoads}
    />
  );
}
