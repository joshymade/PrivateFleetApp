"use server";

import { revalidatePath } from "next/cache";
import { canAccessAdminUsers, getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export type DeletionActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await getSessionProfile();
  if (!session || !canAccessAdminUsers(session.role)) {
    return { session: null as null, error: "Admin access required." };
  }
  return { session, error: null as null };
}

function revalidateDeletionSurfaces(reportId: string | null) {
  revalidatePath("/admin/deletion-requests");
  revalidatePath("/account/notifications");
  revalidatePath("/feed");
  if (reportId) {
    revalidatePath(`/feed/${reportId}`);
  }
}

/** Approve → hard-delete the report (cascades request row). */
export async function approveReportDeletion(
  requestId: string,
): Promise<DeletionActionResult> {
  const { session, error } = await requireAdmin();
  if (!session) return { ok: false, error: error ?? "Admin access required." };

  const supabase = await createClient();
  const { data: request, error: reqError } = await supabase
    .from("report_deletion_requests")
    .select("id, damage_report_id, status, requested_by")
    .eq("id", requestId)
    .maybeSingle();

  if (reqError) return { ok: false, error: reqError.message };
  if (!request) return { ok: false, error: "Request not found." };
  if (request.status !== "pending") {
    return { ok: false, error: "This request was already reviewed." };
  }

  const reportId = request.damage_report_id as string;
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("report_deletion_requests")
    .update({
      status: "approved",
      reviewed_by: session.userId,
      reviewed_at: now,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (updateError) return { ok: false, error: updateError.message };

  const { error: deleteError } = await supabase
    .from("damage_reports")
    .delete()
    .eq("id", reportId);

  if (deleteError) return { ok: false, error: deleteError.message };

  revalidateDeletionSurfaces(reportId);
  revalidatePath("/home");
  revalidatePath("/safety/inbox");
  return { ok: true, message: "Report deleted." };
}

/** Dismiss → keep the report; notify the driver. */
export async function dismissReportDeletion(
  requestId: string,
): Promise<DeletionActionResult> {
  const { session, error } = await requireAdmin();
  if (!session) return { ok: false, error: error ?? "Admin access required." };

  const supabase = await createClient();
  const { data: request, error: reqError } = await supabase
    .from("report_deletion_requests")
    .select("id, damage_report_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (reqError) return { ok: false, error: reqError.message };
  if (!request) return { ok: false, error: "Request not found." };
  if (request.status !== "pending") {
    return { ok: false, error: "This request was already reviewed." };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("report_deletion_requests")
    .update({
      status: "dismissed",
      reviewed_by: session.userId,
      reviewed_at: now,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (updateError) return { ok: false, error: updateError.message };

  revalidateDeletionSurfaces(request.damage_report_id as string);
  return { ok: true, message: "Request dismissed. Report kept." };
}
