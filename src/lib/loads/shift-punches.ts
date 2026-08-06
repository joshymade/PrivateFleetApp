"use server";

import { revalidatePath } from "next/cache";
import {
  driverNeedsProfileSetup,
  PROFILE_INCOMPLETE_MESSAGE,
} from "@/lib/auth/profile-complete";
import { toPostgresTime } from "@/lib/loads/shift-time";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type ShiftPunchActionResult =
  | { ok: true }
  | { ok: false; error: string };

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function requireDriver() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      supabase,
      user: null,
      error: "Sign in required." as const,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, work_state")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as UserRole | undefined) ?? "driver";
  if (role !== "driver") {
    return {
      supabase,
      user,
      error: "Only drivers can record shift punches." as const,
    };
  }

  if (driverNeedsProfileSetup(role, profile)) {
    return {
      supabase,
      user,
      error: PROFILE_INCOMPLETE_MESSAGE,
    };
  }

  return { supabase, user, error: null };
}

export async function upsertShiftPunch(input: {
  workDate: string;
  startTime: string | null;
  endTime: string | null;
}): Promise<ShiftPunchActionResult> {
  const { supabase, user, error } = await requireDriver();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const workDate = input.workDate.trim();
  if (!isValidDate(workDate)) {
    return { ok: false, error: "Enter a valid work date." };
  }

  const startRaw = input.startTime?.trim() ?? "";
  const endRaw = input.endTime?.trim() ?? "";

  if (!startRaw && !endRaw) {
    return { ok: false, error: "Enter a start or end punch." };
  }

  const start_time = startRaw ? toPostgresTime(startRaw) : null;
  const end_time = endRaw ? toPostgresTime(endRaw) : null;

  if (startRaw && start_time == null) {
    return { ok: false, error: "Enter a valid start time." };
  }
  if (endRaw && end_time == null) {
    return { ok: false, error: "Enter a valid end time." };
  }

  const { error: upsertError } = await supabase.from("shift_punches").upsert(
    {
      driver_id: user.id,
      work_date: workDate,
      start_time,
      end_time,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "driver_id,work_date" },
  );

  if (upsertError) return { ok: false, error: upsertError.message };

  revalidatePath("/home");
  revalidatePath("/loads");
  return { ok: true };
}

export async function deleteShiftPunch(input: {
  workDate: string;
}): Promise<ShiftPunchActionResult> {
  const { supabase, user, error } = await requireDriver();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const workDate = input.workDate.trim();
  if (!isValidDate(workDate)) {
    return { ok: false, error: "Enter a valid work date." };
  }

  const { error: deleteError } = await supabase
    .from("shift_punches")
    .delete()
    .eq("driver_id", user.id)
    .eq("work_date", workDate);

  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/home");
  revalidatePath("/loads");
  return { ok: true };
}
