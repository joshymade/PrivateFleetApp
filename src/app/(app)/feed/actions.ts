"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; error: string };

function feedPaths(reportId: string) {
  return [`/feed`, `/feed/${reportId}`] as const;
}

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

async function getCallerRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<UserRole> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as UserRole | undefined) ?? "driver";
}

async function getViewerRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as string | undefined) ?? "driver";
}

/**
 * Increments damage_reports.view_count once per detail page open.
 * Distinct from Notice (damage_notices). Called from ReportViewTracker on mount.
 */
export async function recordReportView(reportId: string): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const { error: rpcError } = await supabase.rpc(
    "increment_damage_report_view",
    { p_report_id: reportId },
  );

  if (rpcError) return { ok: false, error: rpcError.message };

  revalidatePath("/feed");
  return { ok: true };
}

export async function noticeReport(reportId: string): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const role = await getViewerRole(supabase, user.id);
  if (role === "safety") {
    return { ok: false, error: "Safety accounts cannot Notice reports." };
  }

  const { error: insertError } = await supabase.from("damage_notices").insert({
    damage_report_id: reportId,
    noticed_by: user.id,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: true };
    }
    return { ok: false, error: insertError.message };
  }

  for (const path of feedPaths(reportId)) revalidatePath(path);
  revalidatePath("/profile");
  return { ok: true };
}

/** Notices are permanent — un-notice is rejected and never deletes the row. */
export async function unnoticeReport(
  _reportId: string,
): Promise<ActionResult> {
  return { ok: false, error: "Notices cannot be removed." };
}

/**
 * One-way beep on a Feed reply comment (like Notice).
 * Duplicate inserts are treated as success (already beeped).
 */
export async function beepComment(
  reportId: string,
  commentId: string,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const role = await getViewerRole(supabase, user.id);
  if (role === "safety") {
    return { ok: false, error: "Safety accounts cannot beep replies." };
  }

  const { data: comment, error: commentError } = await supabase
    .from("damage_report_comments")
    .select("id, damage_report_id")
    .eq("id", commentId)
    .maybeSingle();

  if (commentError) return { ok: false, error: commentError.message };
  if (!comment || comment.damage_report_id !== reportId) {
    return { ok: false, error: "Reply not found." };
  }

  const { error: insertError } = await supabase
    .from("damage_report_comment_beeps")
    .insert({
      comment_id: commentId,
      user_id: user.id,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: true };
    }
    return { ok: false, error: insertError.message };
  }

  for (const path of feedPaths(reportId)) revalidatePath(path);
  return { ok: true };
}

/** Beeps are permanent — unbeep is rejected and never deletes the row. */
export async function unbeepComment(
  _reportId: string,
  _commentId: string,
): Promise<ActionResult> {
  return { ok: false, error: "Beeps cannot be removed." };
}

export async function addReply(
  reportId: string,
  body: string,
  parentId?: string | null,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const role = await getViewerRole(supabase, user.id);
  if (role === "safety") {
    return { ok: false, error: "Safety accounts cannot reply on reports." };
  }

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Reply cannot be empty." };

  const parent = parentId?.trim() || null;
  if (parent) {
    const { data: parentRow, error: parentError } = await supabase
      .from("damage_report_comments")
      .select("id, damage_report_id")
      .eq("id", parent)
      .maybeSingle();

    if (parentError) return { ok: false, error: parentError.message };
    if (!parentRow || parentRow.damage_report_id !== reportId) {
      return { ok: false, error: "Parent reply not found on this report." };
    }
  }

  const { error: insertError } = await supabase
    .from("damage_report_comments")
    .insert({
      damage_report_id: reportId,
      author_id: user.id,
      parent_id: parent,
      body: trimmed,
    });

  if (insertError) return { ok: false, error: insertError.message };

  for (const path of feedPaths(reportId)) revalidatePath(path);
  revalidatePath("/profile");
  return { ok: true };
}

export async function updateReply(
  reportId: string,
  commentId: string,
  body: string,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Reply cannot be empty." };

  const { error: updateError } = await supabase
    .from("damage_report_comments")
    .update({ body: trimmed })
    .eq("id", commentId)
    .eq("author_id", user.id);

  if (updateError) return { ok: false, error: updateError.message };

  for (const path of feedPaths(reportId)) revalidatePath(path);
  return { ok: true };
}

export async function deleteReply(
  reportId: string,
  commentId: string,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const { data: comment, error: commentError } = await supabase
    .from("damage_report_comments")
    .select("id, author_id, damage_report_id")
    .eq("id", commentId)
    .maybeSingle();

  if (commentError) return { ok: false, error: commentError.message };
  if (!comment || comment.damage_report_id !== reportId) {
    return { ok: false, error: "Reply not found." };
  }

  const role = await getCallerRole(supabase, user.id);
  const isOwner = comment.author_id === user.id;
  if (!isOwner && role !== "admin") {
    return { ok: false, error: "Only the author or an admin can delete this reply." };
  }

  const { error: deleteError } = await supabase
    .from("damage_report_comments")
    .delete()
    .eq("id", commentId);

  if (deleteError) return { ok: false, error: deleteError.message };

  for (const path of feedPaths(reportId)) revalidatePath(path);
  return { ok: true };
}

/** Admin-only: delete a damage report (cascades photos/notices/comments/inbox). */
export async function deleteDamageReport(
  reportId: string,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const role = await getCallerRole(supabase, user.id);
  if (role !== "admin") {
    return { ok: false, error: "Only admins can delete reports." };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("damage_reports")
    .select("id")
    .eq("id", reportId)
    .maybeSingle();

  if (lookupError) return { ok: false, error: lookupError.message };
  if (!existing) return { ok: false, error: "Report not found." };

  const { error: deleteError } = await supabase
    .from("damage_reports")
    .delete()
    .eq("id", reportId);

  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/feed");
  revalidatePath(`/feed/${reportId}`);
  revalidatePath("/safety/inbox");
  revalidatePath("/profile");
  revalidatePath("/home");
  return { ok: true };
}

export async function sendToSafety(
  reportId: string,
  note?: string,
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error ?? "Sign in required." };

  const { data: report, error: reportError } = await supabase
    .from("damage_reports")
    .select("id, reported_by")
    .eq("id", reportId)
    .maybeSingle();

  if (reportError) return { ok: false, error: reportError.message };
  if (!report) return { ok: false, error: "Report not found." };
  if (report.reported_by !== user.id) {
    return { ok: false, error: "Only the reporting driver can send to Safety." };
  }

  const { data: existing } = await supabase
    .from("safety_inbox_items")
    .select("id")
    .eq("damage_report_id", reportId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "Already sent to Safety." };
  }

  const { error: insertError } = await supabase
    .from("safety_inbox_items")
    .insert({
      damage_report_id: reportId,
      sent_by: user.id,
      note: note?.trim() || null,
      status: "pending",
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, error: "Already sent to Safety." };
    }
    return { ok: false, error: insertError.message };
  }

  for (const path of feedPaths(reportId)) revalidatePath(path);
  revalidatePath("/safety/inbox");
  revalidatePath("/profile");
  revalidatePath("/home");
  return { ok: true };
}
