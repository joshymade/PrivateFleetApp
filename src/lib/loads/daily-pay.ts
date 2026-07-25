"use server";

import { revalidatePath } from "next/cache";
import {
  driverNeedsProfileSetup,
  PROFILE_INCOMPLETE_MESSAGE,
} from "@/lib/auth/profile-complete";
import { todayDateString } from "@/lib/loads/date";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type DailyPayActionResult =
  | { ok: true }
  | { ok: false; error: string };

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
      error: "Only drivers can record daily pay." as const,
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

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function dayHasLoads(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  workDate: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("loads")
    .select("id", { count: "exact", head: true })
    .eq("assigned_driver_id", userId)
    .eq("load_date", workDate)
    .neq("status", "cancelled")
    .neq("status", "archived");

  if (error) return true;
  return (count ?? 0) > 0;
}

export async function upsertDailyPay(input: {
  workDate: string;
  amount: number;
  note?: string | null;
}): Promise<DailyPayActionResult> {
  const { supabase, user, error } = await requireDriver();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const workDate = input.workDate.trim();
  const amount = Number(input.amount);
  const noteRaw = input.note?.trim() ?? "";
  const note = noteRaw.length > 0 ? noteRaw.slice(0, 500) : null;

  if (!isValidDate(workDate)) {
    return { ok: false, error: "Enter a valid work date." };
  }
  if (workDate >= todayDateString()) {
    return {
      ok: false,
      error: "Daily pay can only be added for past days.",
    };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Enter a valid pay amount." };
  }

  if (await dayHasLoads(supabase, user.id, workDate)) {
    return {
      ok: false,
      error: "This day already has a load. Use load pay instead.",
    };
  }

  const { error: upsertError } = await supabase.from("daily_pay_entries").upsert(
    {
      driver_id: user.id,
      work_date: workDate,
      amount,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "driver_id,work_date" },
  );

  if (upsertError) return { ok: false, error: upsertError.message };

  revalidatePath("/home");
  return { ok: true };
}

export async function deleteDailyPay(input: {
  workDate: string;
}): Promise<DailyPayActionResult> {
  const { supabase, user, error } = await requireDriver();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const workDate = input.workDate.trim();
  if (!isValidDate(workDate)) {
    return { ok: false, error: "Enter a valid work date." };
  }

  const { error: deleteError } = await supabase
    .from("daily_pay_entries")
    .delete()
    .eq("driver_id", user.id)
    .eq("work_date", workDate);

  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/home");
  return { ok: true };
}
