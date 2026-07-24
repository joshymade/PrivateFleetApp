"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessAdminUsers, getSessionProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ContactRequestCategory, UserRole } from "@/types/database";

export type AdminActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const CATEGORY_LABELS: Record<ContactRequestCategory, string> = {
  identity: "Driver info",
  app_issue: "App issue",
  feature: "Feature",
  other: "Other",
};

async function requireAdmin() {
  const session = await getSessionProfile();
  if (!session || !canAccessAdminUsers(session.role)) {
    return { session: null as null, error: "Admin access required." };
  }
  return { session, error: null as null };
}

function adminClientOrError():
  | { admin: ReturnType<typeof createAdminClient>; error: null }
  | { admin: null; error: string } {
  try {
    return { admin: createAdminClient(), error: null };
  } catch (e) {
    return {
      admin: null,
      error: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }
}

/** Long ban so Auth also rejects until re-enabled. */
const DISABLE_BAN_DURATION = "876000h";

export async function replyToContactRequest(input: {
  contactRequestId: string;
  body: string;
}): Promise<AdminActionResult> {
  const { session, error } = await requireAdmin();
  if (!session) return { ok: false, error: error ?? "Admin access required." };

  const body = input.body.trim();
  if (body.length < 1) return { ok: false, error: "Enter a reply." };
  if (body.length > 4000) return { ok: false, error: "Reply is too long." };

  const supabase = await createClient();
  const { data: request, error: reqError } = await supabase
    .from("contact_requests")
    .select("id, driver_id")
    .eq("id", input.contactRequestId)
    .maybeSingle();

  if (reqError) return { ok: false, error: reqError.message };
  if (!request) return { ok: false, error: "Contact request not found." };

  const { error: insertError } = await supabase.from("contact_replies").insert({
    contact_request_id: request.id,
    admin_id: session.userId,
    body,
  });

  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath(`/admin/users/${request.driver_id}`);
  revalidatePath("/account/contact");
  return { ok: true, message: "Reply sent." };
}

export async function setUserDisabled(
  userId: string,
  disabled: boolean,
): Promise<AdminActionResult> {
  const { session, error } = await requireAdmin();
  if (!session) return { ok: false, error: error ?? "Admin access required." };
  if (userId === session.userId) {
    return { ok: false, error: "You cannot disable your own account." };
  }

  const { admin, error: adminError } = adminClientOrError();
  if (!admin) return { ok: false, error: adminError };

  const disabledAt = disabled ? new Date().toISOString() : null;
  const { error: profileError } = await admin
    .from("profiles")
    .update({ disabled_at: disabledAt })
    .eq("id", userId);

  if (profileError) return { ok: false, error: profileError.message };

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? DISABLE_BAN_DURATION : "none",
  });

  if (banError) return { ok: false, error: banError.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return {
    ok: true,
    message: disabled ? "Account disabled." : "Account re-enabled.",
  };
}

export async function resetUserReports(
  userId: string,
): Promise<AdminActionResult> {
  const { session, error } = await requireAdmin();
  if (!session) return { ok: false, error: error ?? "Admin access required." };

  const { admin, error: adminError } = adminClientOrError();
  if (!admin) return { ok: false, error: adminError };

  const { error: deleteError, count } = await admin
    .from("damage_reports")
    .delete({ count: "exact" })
    .eq("reported_by", userId);

  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/feed");
  return {
    ok: true,
    message: `Deleted ${count ?? 0} damage report(s).`,
  };
}

export async function resetUserLoads(
  userId: string,
): Promise<AdminActionResult> {
  const { session, error } = await requireAdmin();
  if (!session) return { ok: false, error: error ?? "Admin access required." };

  const { admin, error: adminError } = adminClientOrError();
  if (!admin) return { ok: false, error: adminError };

  const { error: deleteError, count } = await admin
    .from("loads")
    .delete({ count: "exact" })
    .eq("assigned_driver_id", userId);

  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return {
    ok: true,
    message: `Deleted ${count ?? 0} load(s).`,
  };
}

/**
 * Deletes all user data then the Auth user (profiles cascade from auth.users).
 * Reports must be deleted first (reported_by ON DELETE RESTRICT).
 */
export async function deleteUserAccount(
  userId: string,
): Promise<AdminActionResult> {
  const { session, error } = await requireAdmin();
  if (!session) return { ok: false, error: error ?? "Admin access required." };
  if (userId === session.userId) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  const { admin, error: adminError } = adminClientOrError();
  if (!admin) return { ok: false, error: adminError };

  const { error: reportsError } = await admin
    .from("damage_reports")
    .delete()
    .eq("reported_by", userId);
  if (reportsError) return { ok: false, error: reportsError.message };

  const { error: loadsError } = await admin
    .from("loads")
    .delete()
    .eq("assigned_driver_id", userId);
  if (loadsError) return { ok: false, error: loadsError.message };

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
  if (deleteAuthError) return { ok: false, error: deleteAuthError.message };

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<AdminActionResult> {
  const { session, error } = await requireAdmin();
  if (!session) return { ok: false, error: error ?? "Admin access required." };

  const supabase = await createClient();
  const patch: { role: UserRole; driver_id?: null } = { role };
  if (role === "safety" || role === "admin") {
    patch.driver_id = null;
  }

  const { data, error: updateError } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!data) {
    return { ok: false, error: "Role was not updated." };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, message: `Role set to ${role}.` };
}

export function contactCategoryLabel(
  category: ContactRequestCategory,
): string {
  return CATEGORY_LABELS[category] ?? category;
}
