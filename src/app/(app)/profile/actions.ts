"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isProfileComplete } from "@/lib/auth/profile-complete";
import { sendDriverContactAdminEmail } from "@/lib/email/resend";
import { composeFullName } from "@/lib/profile-name";
import { createClient } from "@/lib/supabase/server";
import { isUsStateCode } from "@/lib/us-states";

export type ActionResult =
  | { ok: true; profileComplete?: boolean }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null as null, error: "Sign in required." };
  }
  return { supabase, user, error: null as null };
}

function identityLockedMessage(errorMessage: string | undefined) {
  if (
    errorMessage &&
    /no identity changes remaining|contact admin/i.test(errorMessage)
  ) {
    return "You have already used your free name/state change. Contact Admin to update these details.";
  }
  return errorMessage ?? "Could not update profile.";
}

function revalidateNotificationSurfaces() {
  revalidatePath("/feed", "layout");
  revalidatePath("/safety/inbox", "layout");
  revalidatePath("/", "layout");
}

export async function markNotificationRead(
  notificationId: string,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const { error: updateError } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .is("read_at", null);

  if (updateError) return { ok: false, error: updateError.message };

  revalidateNotificationSurfaces();
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const { error: updateError } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (updateError) return { ok: false, error: updateError.message };

  revalidateNotificationSurfaces();
  return { ok: true };
}

export async function updateProfileName(
  firstName: string,
  lastInitial: string,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const composed = composeFullName(firstName, lastInitial);
  if (composed.length > 120) {
    return { ok: false, error: "Name is too long." };
  }

  const { data: before } = await supabase
    .from("profiles")
    .select("full_name, work_state, role, identity_changes_remaining")
    .eq("id", user.id)
    .maybeSingle();

  const role = (before?.role as string | undefined) ?? "driver";
  const alreadyComplete = role === "driver" && isProfileComplete(before);
  const nameUnchanged = (before?.full_name ?? null) === (composed || null);

  if (
    alreadyComplete &&
    !nameUnchanged &&
    (before?.identity_changes_remaining ?? 0) <= 0
  ) {
    return {
      ok: false,
      error:
        "You have already used your free name/state change. Contact Admin to update these details.",
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ full_name: composed || null })
    .eq("id", user.id)
    .select("full_name, work_state, role")
    .single();

  if (updateError) {
    return { ok: false, error: identityLockedMessage(updateError.message) };
  }

  revalidatePath("/profile");
  revalidatePath("/home");

  const wasIncomplete =
    (before?.role ?? "driver") === "driver" && !isProfileComplete(before);
  if (wasIncomplete && isProfileComplete(updated)) {
    redirect("/home");
  }
  return { ok: true, profileComplete: isProfileComplete(updated) };
}

export async function updateProfileWorkState(
  workState: string | null,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const normalized =
    workState && workState.trim() ? workState.trim().toUpperCase() : null;

  if (normalized && !isUsStateCode(normalized)) {
    return { ok: false, error: "Choose a valid U.S. state." };
  }

  const { data: before } = await supabase
    .from("profiles")
    .select("full_name, work_state, role, identity_changes_remaining")
    .eq("id", user.id)
    .maybeSingle();

  const role = (before?.role as string | undefined) ?? "driver";
  const alreadyComplete = role === "driver" && isProfileComplete(before);
  const stateUnchanged = (before?.work_state ?? null) === normalized;

  if (
    alreadyComplete &&
    !stateUnchanged &&
    (before?.identity_changes_remaining ?? 0) <= 0
  ) {
    return {
      ok: false,
      error:
        "You have already used your free name/state change. Contact Admin to update these details.",
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ work_state: normalized })
    .eq("id", user.id)
    .select("full_name, work_state, role")
    .single();

  if (updateError) {
    return { ok: false, error: identityLockedMessage(updateError.message) };
  }

  revalidatePath("/profile");
  revalidatePath("/home");

  const wasIncomplete =
    (before?.role ?? "driver") === "driver" && !isProfileComplete(before);
  if (wasIncomplete && isProfileComplete(updated)) {
    redirect("/home");
  }
  return { ok: true, profileComplete: isProfileComplete(updated) };
}

export async function updateAdminContactEmail(
  contactEmail: string | null,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { ok: false, error: "Only admins can set a contact email." };
  }

  const normalized =
    contactEmail && contactEmail.trim() ? contactEmail.trim() : null;

  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ admin_contact_email: normalized })
    .eq("id", user.id);

  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/profile");
  return { ok: true };
}

export async function contactAdminAboutIdentity(input: {
  email: string;
  message: string;
}): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const email = input.email.trim();
  const message = input.message.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (message.length < 5) {
    return { ok: false, error: "Please include a short message for Admin." };
  }
  if (message.length > 2000) {
    return { ok: false, error: "Message is too long." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, driver_id, full_name, identity_changes_remaining")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "driver") {
    return { ok: false, error: "Only drivers can send this request." };
  }

  const { data: admins, error: adminError } = await supabase
    .from("profiles")
    .select("admin_contact_email")
    .eq("role", "admin")
    .not("admin_contact_email", "is", null);

  if (adminError) return { ok: false, error: adminError.message };

  const to = [
    ...new Set(
      (admins ?? [])
        .map((a) => a.admin_contact_email?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  ];

  if (to.length === 0) {
    return {
      ok: false,
      error: "Admin has not configured a contact email yet.",
    };
  }

  const sent = await sendDriverContactAdminEmail({
    to,
    driverEmail: email,
    driverId: profile.driver_id ?? null,
    driverDisplayName: profile.full_name ?? null,
    message,
  });

  if (!sent.ok) return sent;
  return { ok: true };
}
