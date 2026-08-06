"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isProfileComplete } from "@/lib/auth/profile-complete";
import { currentPayPeriod, todayDateString } from "@/lib/loads/date";
import { composeFullName } from "@/lib/profile-name";
import { createClient } from "@/lib/supabase/server";
import {
  formatTractorNumber,
  isValidTractorNumber,
  TRACTOR_NUMBER_PLACEHOLDER,
} from "@/lib/tractor-number";
import { isUsStateCode } from "@/lib/us-states";
import {
  SITE_ALERT_MESSAGE_MAX,
  type ContactRequestCategory,
} from "@/types/database";

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

function revalidateSplashSurfaces() {
  revalidatePath("/");
  revalidatePath("/account");
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

export async function updateSplashText(
  splashText: string,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { ok: false, error: "Only admins can edit splash text." };
  }

  const value = splashText.trim();
  if (value.length > 2000) {
    return { ok: false, error: "Splash text must be 2000 characters or fewer." };
  }

  const { error: upsertError } = await supabase.from("app_settings").upsert(
    {
      key: "splash_text",
      value,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "key" },
  );

  if (upsertError) return { ok: false, error: upsertError.message };

  revalidateSplashSurfaces();
  return { ok: true };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createSiteAlert(input: {
  message: string;
  startsOn: string;
  endsOn: string;
}): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { ok: false, error: "Only admins can publish site notices." };
  }

  const message = input.message.trim();
  if (message.length < 1) {
    return { ok: false, error: "Enter a notice." };
  }
  if (message.length > SITE_ALERT_MESSAGE_MAX) {
    return {
      ok: false,
      error: `Notice must be ${SITE_ALERT_MESSAGE_MAX} characters or fewer.`,
    };
  }
  if (!DATE_RE.test(input.startsOn) || !DATE_RE.test(input.endsOn)) {
    return { ok: false, error: "Choose valid start and end dates." };
  }
  if (input.endsOn < input.startsOn) {
    return { ok: false, error: "End date must be on or after start date." };
  }

  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from("site_alerts").insert({
    message,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    active: true,
    created_by: user.id,
    created_at: now,
    updated_at: now,
  });

  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setSiteAlertActive(
  alertId: string,
  active: boolean,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { ok: false, error: "Only admins can update site notices." };
  }

  const { data, error: updateError } = await supabase
    .from("site_alerts")
    .update({
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId)
    .select("id")
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!data) return { ok: false, error: "Notice not found." };

  revalidatePath("/", "layout");
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

function parseLocalDateInput(
  raw: string,
  label: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: `Enter a valid ${label}.` };
  }
  const [y, m, d] = trimmed.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return { ok: false, error: `Enter a valid ${label}.` };
  }
  return { ok: true, value: trimmed };
}

/** Drivers set seed Sat→Fri range; deposit is derived as Friday end + 6. */
export async function updatePayPeriod(input: {
  payPeriodStart: string | null;
  nextPayDate: string | null;
}): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const startRaw = input.payPeriodStart?.trim() ?? "";
  const endRaw = input.nextPayDate?.trim() ?? "";

  if (!startRaw && !endRaw) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ pay_period_start: null, next_pay_date: null })
      .eq("id", user.id);
    if (updateError) return { ok: false, error: updateError.message };
    revalidateAccountSurfaces();
    return { ok: true };
  }

  if (!startRaw || !endRaw) {
    return {
      ok: false,
      error: "Set both pay period start and end, or clear both.",
    };
  }

  const startParsed = parseLocalDateInput(startRaw, "period start date");
  if (!startParsed.ok) return startParsed;
  const endParsed = parseLocalDateInput(endRaw, "period end date");
  if (!endParsed.ok) return endParsed;

  const payPeriodStart = startParsed.value;
  const nextPayDate = endParsed.value;

  if (nextPayDate < payPeriodStart) {
    return { ok: false, error: "Period end must be on or after start." };
  }

  const [sy, sm, sd] = payPeriodStart.split("-").map(Number);
  const [ey, em, ed] = nextPayDate.split("-").map(Number);
  const startWeekday = new Date(sy, sm - 1, sd).getDay();
  const endWeekday = new Date(ey, em - 1, ed).getDay();
  // Saturday = 6, Friday = 5
  if (startWeekday !== 6) {
    return {
      ok: false,
      error: "Period start must be a Saturday.",
    };
  }
  if (endWeekday !== 5) {
    return {
      ok: false,
      error: "Period end must be a Friday.",
    };
  }

  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  const lengthDays = Math.round((endUtc - startUtc) / 86_400_000) + 1;

  // Work periods are always biweekly (14 days inclusive Sat→Fri).
  if (lengthDays !== 14) {
    return {
      ok: false,
      error: "Pay period must be biweekly (14 days, Saturday–Friday).",
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      pay_period_start: payPeriodStart,
      next_pay_date: nextPayDate,
    })
    .eq("id", user.id);

  if (updateError) return { ok: false, error: updateError.message };

  revalidateAccountSurfaces();
  return { ok: true };
}

/** @deprecated Prefer updatePayPeriod. Accepts a Thursday deposit and derives Sat→Fri. */
export async function updateNextPayDate(input: {
  nextPayDate: string | null;
}): Promise<ActionResult> {
  const raw = input.nextPayDate?.trim() ?? "";
  if (!raw) {
    return updatePayPeriod({ payPeriodStart: null, nextPayDate: null });
  }
  const depositParsed = parseLocalDateInput(raw, "deposit date");
  if (!depositParsed.ok) return depositParsed;

  const [y, m, d] = depositParsed.value.split("-").map(Number);
  const depositWeekday = new Date(y, m - 1, d).getDay();
  if (depositWeekday !== 4) {
    return { ok: false, error: "Deposit day must be a Thursday." };
  }

  // Deposit Thu → period end Fri (−6) → biweekly start Sat (−13 from end).
  const endDate = new Date(y, m - 1, d - 6);
  const startDate = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate() - 13,
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  const nextPayDate = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;
  const payPeriodStart = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
  return updatePayPeriod({
    payPeriodStart,
    nextPayDate,
  });
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

export async function updateProfileRegion(
  region: number | null,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  if (region !== null) {
    if (!Number.isInteger(region) || region < 1 || region > 6) {
      return { ok: false, error: "Choose a region from 1 to 6." };
    }
  } else {
    return { ok: false, error: "Choose a region from 1 to 6." };
  }

  const { data: before } = await supabase
    .from("profiles")
    .select("role, region, region_locked")
    .eq("id", user.id)
    .maybeSingle();

  if (before?.role !== "driver") {
    return { ok: false, error: "Only drivers can set their own region." };
  }

  if (before.region_locked) {
    return {
      ok: false,
      error: "Region is locked. Contact Admin to request a change.",
    };
  }

  if ((before.region ?? null) === region) {
    return { ok: true };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ region })
    .eq("id", user.id);

  if (updateError) {
    if (/region is locked|contact admin/i.test(updateError.message)) {
      return {
        ok: false,
        error: "Region is locked. Contact Admin to request a change.",
      };
    }
    return { ok: false, error: updateError.message };
  }

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
  if (!Number.isFinite(adpAmount) || adpAmount < 0) {
    return { ok: false, error: "Enter a valid ADP amount." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("pay_period_start, next_pay_date")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return { ok: false, error: profileError.message };

  const seedStart = profile?.pay_period_start?.trim() ?? "";
  const seedEnd = profile?.next_pay_date?.trim() ?? "";
  if (!seedStart || !seedEnd) {
    return {
      ok: false,
      error: "Set your pay period first, then enter ADP for a previous period.",
    };
  }

  const current = currentPayPeriod(todayDateString(), seedStart, seedEnd);
  const matched = currentPayPeriod(periodStart, seedStart, seedEnd);

  if (matched.start !== periodStart || matched.end !== periodEnd) {
    return {
      ok: false,
      error: "Pick a valid previous pay period from your deposit cadence.",
    };
  }
  if (matched.start >= current.start) {
    return {
      ok: false,
      error: "ADP is for previous pay periods only (after payday).",
    };
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
  message: string;
}): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const message = input.message.trim();

  if (message.length < 5) {
    return { ok: false, error: "Please include a short message for Admin." };
  }
  if (message.length > 2000) {
    return { ok: false, error: "Message is too long." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "driver") {
    return { ok: false, error: "Only drivers can send this request." };
  }

  const { error: insertError } = await supabase.from("contact_requests").insert({
    driver_id: user.id,
    category: "identity",
    message,
    source: "user",
  });

  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/account/contact");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function submitContactRequest(input: {
  category: ContactRequestCategory;
  message: string;
}): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

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
  if (message.length < 5) {
    return { ok: false, error: "Please include a short message." };
  }
  if (message.length > 4000) {
    return { ok: false, error: "Message is too long." };
  }

  const { error: insertError } = await supabase.from("contact_requests").insert({
    driver_id: user.id,
    category,
    message,
    source: "user",
  });

  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/account/contact");
  revalidatePath("/admin/users");
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

/** Delete all loads assigned to the signed-in driver (blank slate). */
export async function resetOwnLoads(): Promise<
  ActionResult & { deleted?: number }
> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_system_anonymous")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "driver" || profile.is_system_anonymous) {
    return { ok: false, error: "Only drivers can reset their loads." };
  }

  const { error: deleteError, count } = await supabase
    .from("loads")
    .delete({ count: "exact" })
    .eq("assigned_driver_id", user.id);

  if (deleteError) return { ok: false, error: deleteError.message };

  revalidateAccountSurfaces();
  revalidatePath("/loads");
  revalidatePath("/home");
  return { ok: true, deleted: count ?? 0 };
}

/**
 * Reassign all of the driver's damage reports to Anonymous Driver.
 * Reports stay on the Feed; original_reported_by is preserved.
 */
export async function anonymizeOwnDamageReports(): Promise<
  ActionResult & { anonymized?: number }
> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_system_anonymous")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "driver" || profile.is_system_anonymous) {
    return {
      ok: false,
      error: "Only drivers can reset damage report tags.",
    };
  }

  const { data, error: rpcError } = await supabase.rpc(
    "anonymize_own_damage_reports",
  );

  if (rpcError) return { ok: false, error: rpcError.message };

  revalidateAccountSurfaces();
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
  revalidatePath("/account/notifications");
  return {
    ok: true,
    anonymized: typeof data === "number" ? data : Number(data ?? 0),
  };
}

const MIN_PASSWORD_LENGTH = 6;

/**
 * Sets a new password and clears profiles.must_change_password.
 * Used by the forced change-password gate for admin-created accounts.
 */
export async function changePasswordForced(input: {
  password: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const password = input.password;
  const confirmPassword = input.confirmPassword;

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: "Passwords do not match." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.must_change_password) {
    return { ok: false, error: "Password change is not required." };
  }

  const { error: authError } = await supabase.auth.updateUser({ password });
  if (authError) return { ok: false, error: authError.message };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  if (profileError) {
    return {
      ok: false,
      error: `Password updated, but could not clear the change flag: ${profileError.message}`,
    };
  }

  // Best-effort: clear user_metadata flag if present.
  await supabase.auth.updateUser({
    data: { must_change_password: false },
  });

  revalidateAccountSurfaces();
  revalidatePath("/account/change-password");
  redirect("/home");
}

