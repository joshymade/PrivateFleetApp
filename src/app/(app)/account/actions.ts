"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isProfileComplete } from "@/lib/auth/profile-complete";
import {
  sendDriverContactAdminEmail,
  sendDriverContactRequestEmail,
} from "@/lib/email/resend";
import { composeFullName } from "@/lib/profile-name";
import { createClient } from "@/lib/supabase/server";
import {
  formatTractorNumber,
  isValidTractorNumber,
  TRACTOR_NUMBER_PLACEHOLDER,
} from "@/lib/tractor-number";
import { isUsStateCode } from "@/lib/us-states";
import type { ContactRequestCategory } from "@/types/database";

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

function revalidateAccountSurfaces() {
  revalidatePath("/account");
  revalidatePath("/account", "layout");
  revalidatePath("/home");
  revalidatePath("/loads");
}

function revalidateNotificationSurfaces() {
  revalidatePath("/feed", "layout");
  revalidatePath("/safety/inbox", "layout");
  revalidatePath("/account/notifications");
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

  revalidateAccountSurfaces();

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

  revalidateAccountSurfaces();

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

  revalidateAccountSurfaces();
  return { ok: true };
}

export async function updateDriverWeekPrefs(input: {
  weekStartDay: number;
  offDays: number[];
}): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const weekStartDay = Number(input.weekStartDay);
  if (!Number.isInteger(weekStartDay) || weekStartDay < 0 || weekStartDay > 6) {
    return { ok: false, error: "Choose a valid start-of-week day." };
  }

  const offDays = [
    ...new Set(
      (input.offDays ?? [])
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    ),
  ].sort((a, b) => a - b);

  if (offDays.length > 4) {
    return { ok: false, error: "Select at most 4 off days." };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ week_start_day: weekStartDay, off_days: offDays })
    .eq("id", user.id);

  if (updateError) return { ok: false, error: updateError.message };

  revalidateAccountSurfaces();
  return { ok: true };
}

export async function updateCurrentTruckNumber(input: {
  currentTruckNumber: string;
}): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const raw = String(input.currentTruckNumber ?? "").trim();
  let currentTruckNumber: string | null = null;
  if (raw) {
    if (!isValidTractorNumber(raw)) {
      return {
        ok: false,
        error: `Truck number must be exactly 6 digits (e.g. ${TRACTOR_NUMBER_PLACEHOLDER}).`,
      };
    }
    currentTruckNumber = formatTractorNumber(raw);
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ current_truck_number: currentTruckNumber })
    .eq("id", user.id);

  if (updateError) return { ok: false, error: updateError.message };

  revalidateAccountSurfaces();
  return { ok: true };
}

export async function createAdpEntry(input: {
  periodStart: string;
  periodEnd: string;
  adpAmount: number;
}): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const periodStart = input.periodStart.trim();
  const periodEnd = input.periodEnd.trim();
  const adpAmount = Number(input.adpAmount);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) {
    return { ok: false, error: "Enter a valid period start date." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    return { ok: false, error: "Enter a valid period end date." };
  }
  if (periodEnd < periodStart) {
    return { ok: false, error: "Period end must be on or after start." };
  }
  if (!Number.isFinite(adpAmount) || adpAmount < 0) {
    return { ok: false, error: "Enter a valid ADP amount." };
  }

  const { error: insertError } = await supabase.from("adp_entries").upsert(
    {
      driver_id: user.id,
      period_start: periodStart,
      period_end: periodEnd,
      adp_amount: adpAmount,
    },
    { onConflict: "driver_id,period_start" },
  );

  if (insertError) return { ok: false, error: insertError.message };

  revalidateAccountSurfaces();
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

  await supabase.from("contact_requests").insert({
    driver_id: user.id,
    category: "identity",
    message,
  });

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

export async function submitContactRequest(input: {
  email: string;
  category: ContactRequestCategory;
  message: string;
}): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const email = input.email.trim();
  const message = input.message.trim();
  const category = input.category;

  const allowed: ContactRequestCategory[] = [
    "identity",
    "app_issue",
    "feature",
    "other",
  ];
  if (!allowed.includes(category)) {
    return { ok: false, error: "Choose a valid category." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (message.length < 5) {
    return { ok: false, error: "Please include a short message." };
  }
  if (message.length > 4000) {
    return { ok: false, error: "Message is too long." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, driver_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

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

  const { error: insertError } = await supabase.from("contact_requests").insert({
    driver_id: user.id,
    category,
    message,
  });

  if (insertError) return { ok: false, error: insertError.message };

  const sent = await sendDriverContactRequestEmail({
    to,
    driverEmail: email,
    driverId: profile?.driver_id ?? null,
    driverDisplayName: profile?.full_name ?? null,
    category,
    message,
  });

  if (!sent.ok) return sent;
  return { ok: true };
}

export async function markContactRepliesRead(
  replyIds: string[],
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };
  if (replyIds.length === 0) return { ok: true };

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("contact_replies")
    .update({ read_at: now })
    .in("id", replyIds)
    .is("read_at", null);

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true };
}
