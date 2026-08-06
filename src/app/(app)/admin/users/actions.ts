"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessAdminUsers, getSessionProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ANONYMOUS_DRIVER_PROFILE_ID,
  type UserRole,
} from "@/types/database";

export type AdminActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

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
  revalidatePath("/account/notifications");
  return { ok: true, message: "Reply sent." };
}

/** Admin → user message (seeds a thread when none exists). */
export async function messageUser(input: {
  userId: string;
  body: string;
}): Promise<AdminActionResult> {
  const { session, error } = await requireAdmin();
  if (!session) return { ok: false, error: error ?? "Admin access required." };

  const body = input.body.trim();
  if (body.length < 1) return { ok: false, error: "Enter a message." };
  if (body.length > 4000) return { ok: false, error: "Message is too long." };
  if (input.userId === session.userId) {
    return { ok: false, error: "You cannot message yourself." };
  }

  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", input.userId)
    .maybeSingle();

  if (targetError) return { ok: false, error: targetError.message };
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "admin") {
    return { ok: false, error: "Message non-admin users from their profile." };
  }

  const { data: latest, error: latestError } = await supabase
    .from("contact_requests")
    .select("id")
    .eq("driver_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) return { ok: false, error: latestError.message };

  let requestId = latest?.id ?? null;

  if (!requestId) {
    const { data: seeded, error: seedError } = await supabase
      .from("contact_requests")
      .insert({
        driver_id: input.userId,
        category: "other",
        message: "",
        source: "admin",
      })
      .select("id")
      .single();

    if (seedError) return { ok: false, error: seedError.message };
    requestId = seeded.id;
  }

  const { error: insertError } = await supabase.from("contact_replies").insert({
    contact_request_id: requestId,
    admin_id: session.userId,
    body,
  });

  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath("/account/contact");
  revalidatePath("/account/notifications");
  return { ok: true, message: "Message sent." };
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
  if (userId === ANONYMOUS_DRIVER_PROFILE_ID) {
    return { ok: false, error: "Cannot reset the system Anonymous Driver." };
  }

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
  if (userId === ANONYMOUS_DRIVER_PROFILE_ID) {
    return { ok: false, error: "Cannot delete the system Anonymous Driver." };
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

  if (role !== "driver" && role !== "safety") {
    return {
      ok: false,
      error: "Role must be driver or safety. Admin promotion is not available here.",
    };
  }

  const supabase = await createClient();
  const patch: { role: UserRole; driver_id?: null } = { role };
  if (role === "safety") {
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

export async function updateUserRegion(
  userId: string,
  region: number | null,
): Promise<AdminActionResult> {
  const { session, error } = await requireAdmin();
  if (!session) return { ok: false, error: error ?? "Admin access required." };

  if (region !== null) {
    if (!Number.isInteger(region) || region < 1 || region > 6) {
      return { ok: false, error: "Region must be 1–6 or empty." };
    }
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (!target) return { ok: false, error: "User not found." };
  if (target.role !== "driver" && target.role !== "safety") {
    return {
      ok: false,
      error: "Region applies to driver and safety accounts only.",
    };
  }

  const { data, error: updateError } = await supabase
    .from("profiles")
    .update({ region })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!data) return { ok: false, error: "Region was not updated." };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return {
    ok: true,
    message:
      region == null ? "Region cleared." : `Region set to ${region}.`,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Matches signup/login HTML minLength and Supabase default minimum. */
const MIN_PASSWORD_LENGTH = 6;

export type CreateUserInput = {
  email: string;
  temporaryPassword: string;
  role: "driver" | "safety";
  /** Optional region for safety (or driver) at create time. */
  region?: number | null;
};

/**
 * Creates an Auth user (confirmed) with a temporary password and forces a
 * password change on first login via profiles.must_change_password.
 */
export async function createUser(
  input: CreateUserInput,
): Promise<AdminActionResult & { userId?: string }> {
  const { session, error } = await requireAdmin();
  if (!session) return { ok: false, error: error ?? "Admin access required." };

  const email = input.email.trim().toLowerCase();
  const temporaryPassword = input.temporaryPassword;
  const role = input.role;
  const region =
    input.region === null || input.region === undefined
      ? null
      : Number(input.region);

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (temporaryPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (role !== "driver" && role !== "safety") {
    return { ok: false, error: "Role must be driver or safety." };
  }
  if (
    region !== null &&
    (!Number.isInteger(region) || region < 1 || region > 6)
  ) {
    return { ok: false, error: "Region must be 1–6 when set." };
  }

  const { admin, error: adminError } = adminClientOrError();
  if (!admin) return { ok: false, error: adminError };

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        must_change_password: true,
      },
    });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return { ok: false, error: "A user with that email already exists." };
    }
    return { ok: false, error: createError.message };
  }

  const userId = created.user?.id;
  if (!userId) {
    return { ok: false, error: "User was created but no id was returned." };
  }

  // handle_new_user inserts the profile; wait briefly if needed then set flags.
  let profileReady = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (existing?.id) {
      profileReady = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  if (!profileReady) {
    return {
      ok: false,
      error:
        "Auth user created but profile is missing. Check signup trigger, then retry role/password flags.",
    };
  }

  const profilePatch: {
    must_change_password: boolean;
    role: "driver" | "safety";
    driver_id?: null;
    region?: number | null;
  } = {
    must_change_password: true,
    role,
  };
  if (role === "safety") {
    profilePatch.driver_id = null;
    profilePatch.region = region;
  } else if (region !== null) {
    profilePatch.region = region;
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update(profilePatch)
    .eq("id", userId);

  if (profileError) {
    return {
      ok: false,
      error: `User created, but profile update failed: ${profileError.message}`,
    };
  }

  revalidatePath("/admin/users");
  return {
    ok: true,
    message: `Created ${role} account for ${email}. They must change password on login.`,
    userId,
  };
}
