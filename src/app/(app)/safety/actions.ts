"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SafetyInboxStatus } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireSafetyOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null as null, error: "Sign in required." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as string | undefined;
  if (role !== "safety" && role !== "admin") {
    return {
      supabase,
      user: null as null,
      error: "Safety or Admin role required.",
    };
  }

  return { supabase, user, error: null as null };
}

export async function updateInboxStatus(
  itemId: string,
  status: Exclude<SafetyInboxStatus, "pending">,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireSafetyOrAdmin();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  if (status !== "reviewed" && status !== "dismissed") {
    return { ok: false, error: "Invalid status." };
  }

  const { data: updated, error: updateError } = await supabase
    .from("safety_inbox_items")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", itemId)
    .select("damage_report_id")
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/safety/inbox");
  revalidatePath(`/safety/inbox/${itemId}`);
  revalidatePath("/feed");
  if (updated?.damage_report_id) {
    revalidatePath(`/feed/${updated.damage_report_id}`);
  }
  revalidatePath("/profile");
  revalidatePath("/home");
  return { ok: true };
}
