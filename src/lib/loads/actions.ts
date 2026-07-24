"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  driverNeedsProfileSetup,
  PROFILE_INCOMPLETE_MESSAGE,
} from "@/lib/auth/profile-complete";
import { createClient } from "@/lib/supabase/server";
import {
  isEndingMileageRequired,
  isPayAmountEditable,
  isStartingMileageRequired,
  PAY_AMOUNT_EDIT_DAYS,
  todayDateString,
} from "@/lib/loads/date";
import type { LoadStopType, UserRole } from "@/types/database";

export type LoadActionState = {
  error?: string;
  success?: string;
};

type ParsedStop = {
  stop_type: LoadStopType;
  stop_name: string;
  pickup_number: string | null;
  trailer_number: string | null;
};

const STOP_TYPES = new Set<LoadStopType>(["store", "vendor", "dc"]);

function canWriteLoads(role: string | undefined): boolean {
  return role === "driver" || role === "admin";
}

async function requireWriter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, error: "Sign in to manage loads." as const, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, work_state")
    .eq("id", user.id)
    .maybeSingle();

  if (!canWriteLoads(profile?.role)) {
    return {
      supabase,
      error: "Only drivers and admins can manage loads." as const,
      user,
      profile,
    };
  }

  const role = (profile?.role as UserRole | undefined) ?? "driver";
  if (driverNeedsProfileSetup(role, profile)) {
    return {
      supabase,
      error: PROFILE_INCOMPLETE_MESSAGE,
      user,
      profile,
    };
  }

  return { supabase, error: null, user, profile };
}

function parseStopType(raw: string): LoadStopType | null {
  const value = raw.trim().toLowerCase();
  return STOP_TYPES.has(value as LoadStopType) ? (value as LoadStopType) : null;
}

function parseStops(formData: FormData): { stops: ParsedStop[]; error?: string } {
  const types = formData.getAll("stop_type").map((v) => String(v));
  const names = formData.getAll("stop_name").map((v) => String(v).trim());
  const pickups = formData.getAll("pickup_number").map((v) => String(v).trim());
  const trailers = formData.getAll("stop_trailer_number").map((v) => String(v).trim());
  const stops: ParsedStop[] = [];

  const rowCount = Math.max(types.length, names.length, pickups.length, trailers.length);
  for (let i = 0; i < rowCount; i++) {
    const stop_name = names[i] ?? "";
    const pickup = pickups[i] ?? "";
    const trailer = trailers[i] ?? "";
    const typeRaw = types[i] ?? "";
    // Skip fully empty rows (extra blank stop slots).
    if (!stop_name && !pickup && !trailer && !typeRaw.trim()) continue;
    if (!stop_name) {
      return { stops: [], error: `Stop ${i + 1} needs a name.` };
    }
    const stop_type = parseStopType(typeRaw);
    if (!stop_type) {
      return {
        stops: [],
        error: `Stop ${i + 1} needs a type (Store, Vendor, or DC).`,
      };
    }
    stops.push({
      stop_type,
      stop_name,
      pickup_number: pickup || null,
      trailer_number: trailer || null,
    });
  }
  return { stops };
}

const ONE_ACTIVE_LOAD_MESSAGE =
  "You already have an active load. Complete it before starting another.";

function isOneActiveLoadViolation(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("loads_one_active_per_driver_uidx") ||
    (lower.includes("unique") && lower.includes("assigned_driver_id"))
  );
}

/**
 * At most one status=active load per assigned_driver_id (DB partial unique index).
 * excludeLoadId: when reassigning/updating, ignore the load being edited.
 */
async function findActiveLoadConflict(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignedDriverId: string,
  excludeLoadId?: string,
): Promise<{ id: string; load_number: string } | null> {
  let query = supabase
    .from("loads")
    .select("id, load_number")
    .eq("assigned_driver_id", assignedDriverId)
    .eq("status", "active")
    .limit(1);

  if (excludeLoadId) {
    query = query.neq("id", excludeLoadId);
  }

  const { data } = await query.maybeSingle();
  return data ?? null;
}

/**
 * Align loads.trailer_number with last checked stop that has a trailer.
 * recordHistory: true when check/uncheck (or promote) makes a trailer current;
 * false when only editing stop fields (adding a trailer to a stop must not log).
 */
async function syncCurrentTrailerFromStops(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loadId: string,
  options?: { recordHistory?: boolean },
): Promise<{ error?: string }> {
  const recordHistory = options?.recordHistory ?? true;
  const { error } = await supabase.rpc("sync_load_current_trailer", {
    p_load_id: loadId,
    p_record_history: recordHistory,
  });

  if (error) return { error: error.message };
  return {};
}

export async function createLoad(
  _prev: LoadActionState,
  formData: FormData,
): Promise<LoadActionState> {
  const { supabase, error, user } = await requireWriter();
  if (error || !user) return { error: error ?? "Sign in to manage loads." };

  const loadNumber = String(formData.get("load_number") ?? "").trim();
  const routeNumber = String(formData.get("route_number") ?? "").trim() || null;
  const loadDate =
    String(formData.get("load_date") ?? "").trim() || todayDateString();
  const paidMilesRaw = String(formData.get("paid_miles") ?? "").trim();
  const paidMiles = paidMilesRaw ? Number(paidMilesRaw) : null;
  const startingMileageRaw = String(
    formData.get("starting_mileage") ?? "",
  ).trim();
  const startingMileage = startingMileageRaw
    ? Number(startingMileageRaw)
    : null;
  // Always assign to self — loads are private to the owning driver.
  const assignedDriverId = user.id;

  const { stops, error: stopsParseError } = parseStops(formData);
  if (stopsParseError) return { error: stopsParseError };

  if (!loadNumber) {
    return { error: "Load number is required." };
  }
  if (isStartingMileageRequired(loadDate)) {
    if (!startingMileageRaw || Number.isNaN(startingMileage)) {
      return { error: "Starting mileage is required." };
    }
  } else if (startingMileageRaw && Number.isNaN(startingMileage)) {
    return { error: "Starting mileage must be a number." };
  }
  if (startingMileage != null && startingMileage < 0) {
    return { error: "Starting mileage must be zero or greater." };
  }
  if (!paidMilesRaw || Number.isNaN(paidMiles)) {
    return { error: "Paid miles is required." };
  }
  if (paidMiles != null && paidMiles < 0) {
    return { error: "Paid miles must be zero or greater." };
  }

  const existingActive = await findActiveLoadConflict(
    supabase,
    assignedDriverId,
  );
  // Queue behind the active load; never create a second active.
  const status = existingActive ? "pending" : "active";

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("current_truck_number")
    .eq("id", user.id)
    .maybeSingle();
  const truckNumber =
    (profileRow as { current_truck_number: string | null } | null)
      ?.current_truck_number?.trim() || null;

  const { data: load, error: insertError } = await supabase
    .from("loads")
    .insert({
      load_number: loadNumber,
      starting_trailer_number: null,
      trailer_number: null,
      route_number: routeNumber,
      truck_number: truckNumber,
      load_date: loadDate,
      paid_miles: paidMiles,
      starting_mileage: startingMileage,
      assigned_driver_id: assignedDriverId,
      status,
    })
    .select("id")
    .single();

  if (insertError || !load) {
    return {
      error: isOneActiveLoadViolation(insertError?.message)
        ? ONE_ACTIVE_LOAD_MESSAGE
        : (insertError?.message ?? "Could not create load."),
    };
  }

  if (stops.length > 0) {
    const { error: stopsError } = await supabase.from("load_stops").insert(
      stops.map((s, i) => ({
        load_id: load.id,
        stop_type: s.stop_type,
        stop_name: s.stop_name,
        pickup_number: s.pickup_number,
        trailer_number: s.trailer_number,
        delivery_order: i + 1,
      })),
    );
    if (stopsError) {
      return { error: stopsError.message };
    }
  }

  revalidatePath("/home");
  revalidatePath("/loads");
  redirect(`/loads/${load.id}`);
}

export async function updateLoad(
  _prev: LoadActionState,
  formData: FormData,
): Promise<LoadActionState> {
  const { supabase, error, user } = await requireWriter();
  if (error || !user) return { error: error ?? "Sign in to manage loads." };

  const loadId = String(formData.get("load_id") ?? "").trim();
  if (!loadId) return { error: "Missing load." };

  const loadNumber = String(formData.get("load_number") ?? "").trim();
  const routeNumber = String(formData.get("route_number") ?? "").trim() || null;
  const loadDate = String(formData.get("load_date") ?? "").trim();
  const paidMilesRaw = String(formData.get("paid_miles") ?? "").trim();
  const paidMiles = paidMilesRaw ? Number(paidMilesRaw) : null;
  const startingMileageRaw = String(
    formData.get("starting_mileage") ?? "",
  ).trim();
  const startingMileage = startingMileageRaw
    ? Number(startingMileageRaw)
    : null;
  const endingMileageRaw = String(formData.get("ending_mileage") ?? "").trim();
  const endingMileage = endingMileageRaw ? Number(endingMileageRaw) : null;
  const payAmountRaw = String(formData.get("pay_amount") ?? "").trim();
  const payAmount = payAmountRaw ? Number(payAmountRaw) : null;

  const { stops, error: stopsParseError } = parseStops(formData);
  if (stopsParseError) return { error: stopsParseError };

  if (!loadNumber || !loadDate) {
    return { error: "Load number and date are required." };
  }
  if (isStartingMileageRequired(loadDate)) {
    if (!startingMileageRaw || Number.isNaN(startingMileage)) {
      return { error: "Starting mileage is required." };
    }
  } else if (startingMileageRaw && Number.isNaN(startingMileage)) {
    return { error: "Starting mileage must be a number." };
  }
  if (startingMileage != null && startingMileage < 0) {
    return { error: "Starting mileage must be zero or greater." };
  }
  if (!paidMilesRaw || Number.isNaN(paidMiles)) {
    return { error: "Paid miles is required." };
  }
  if (paidMiles != null && paidMiles < 0) {
    return { error: "Paid miles must be zero or greater." };
  }
  if (endingMileageRaw && Number.isNaN(endingMileage)) {
    return { error: "Ending mileage must be a number." };
  }
  if (
    startingMileage != null &&
    endingMileage != null &&
    endingMileage < startingMileage
  ) {
    return { error: "Ending mileage must be greater than or equal to starting." };
  }
  if (payAmountRaw && (Number.isNaN(payAmount) || (payAmount != null && payAmount < 0))) {
    return { error: "Pay amount must be a valid number." };
  }

  const patch: Record<string, unknown> = {
    load_number: loadNumber,
    route_number: routeNumber,
    load_date: loadDate,
    paid_miles: paidMiles,
    starting_mileage: startingMileage,
  };
  if (endingMileageRaw) patch.ending_mileage = endingMileage;
  if (payAmountRaw) patch.pay_amount = payAmount;

  const { error: updateError } = await supabase
    .from("loads")
    .update(patch)
    .eq("id", loadId)
    .eq("assigned_driver_id", user.id);

  if (updateError) {
    return {
      error: isOneActiveLoadViolation(updateError.message)
        ? ONE_ACTIVE_LOAD_MESSAGE
        : updateError.message,
    };
  }

  // Preserve departed flags + timestamps by delivery_order before replacing stop rows.
  const { data: priorStops } = await supabase
    .from("load_stops")
    .select("delivery_order, completed, arrived_at")
    .eq("load_id", loadId);
  const priorByOrder = new Map(
    (priorStops ?? []).map((s) => [
      s.delivery_order,
      { completed: s.completed, arrived_at: s.arrived_at as string | null },
    ]),
  );

  await supabase.from("load_stops").delete().eq("load_id", loadId);
  if (stops.length > 0) {
    const { error: stopsError } = await supabase.from("load_stops").insert(
      stops.map((s, i) => {
        const prior = priorByOrder.get(i + 1);
        return {
          load_id: loadId,
          stop_type: s.stop_type,
          stop_name: s.stop_name,
          pickup_number: s.pickup_number,
          trailer_number: s.trailer_number,
          delivery_order: i + 1,
          completed: prior?.completed ?? false,
          arrived_at: prior?.arrived_at ?? null,
        };
      }),
    );
    if (stopsError) return { error: stopsError.message };
  }

  // Keep current trailer aligned after stop edits; do not write history
  // (adding/editing stop trailer_number is not "became current").
  const sync = await syncCurrentTrailerFromStops(supabase, loadId, {
    recordHistory: false,
  });
  if (sync.error) return { error: sync.error };

  revalidatePath("/home");
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
  redirect(`/loads/${loadId}`);
}

/**
 * Mark stop Departed (completed=true). Once departed, uncheck is rejected.
 * Current trailer recomputes from the last departed stop with a trailer.
 */
export async function toggleStopCompleted(
  stopId: string,
  completed: boolean,
): Promise<LoadActionState> {
  const { supabase, error, user } = await requireWriter();
  if (error || !user) return { error: error ?? "Sign in to manage loads." };

  const id = stopId.trim();
  if (!id) return { error: "Missing stop." };

  const { data: stop, error: stopError } = await supabase
    .from("load_stops")
    .select("id, load_id, trailer_number, completed, arrived_at")
    .eq("id", id)
    .maybeSingle();

  if (stopError || !stop) {
    return { error: stopError?.message ?? "Stop not found." };
  }

  if (stop.completed && !completed) {
    return { error: "Departed stops cannot be unchecked." };
  }

  if (stop.completed && completed) {
    return { success: "Already departed." };
  }

  const patch: { completed: boolean; arrived_at?: string } = { completed: true };
  if (!stop.arrived_at) {
    patch.arrived_at = new Date().toISOString();
  }

  const { error: updateStopError } = await supabase
    .from("load_stops")
    .update(patch)
    .eq("id", id);

  if (updateStopError) return { error: updateStopError.message };

  const sync = await syncCurrentTrailerFromStops(supabase, stop.load_id);
  if (sync.error) return { error: sync.error };

  revalidatePath("/home");
  revalidatePath("/loads");
  revalidatePath(`/loads/${stop.load_id}`);
  revalidatePath(`/loads/${stop.load_id}/edit`);
  return { success: "Stop marked Departed." };
}

/**
 * Set a stop's pickup trailer # from the checklist (no history write).
 * Syncs loads.trailer_number from last checked stop with a trailer.
 */
export async function updateStopTrailerNumber(
  stopId: string,
  trailerNumber: string | null,
): Promise<LoadActionState> {
  const { supabase, error, user } = await requireWriter();
  if (error || !user) return { error: error ?? "Sign in to manage loads." };

  const id = stopId.trim();
  if (!id) return { error: "Missing stop." };

  const { data: stop, error: stopError } = await supabase
    .from("load_stops")
    .select("id, load_id")
    .eq("id", id)
    .maybeSingle();

  if (stopError || !stop) {
    return { error: stopError?.message ?? "Stop not found." };
  }

  const trimmed = trailerNumber?.trim() || null;

  const { error: updateStopError } = await supabase
    .from("load_stops")
    .update({ trailer_number: trimmed })
    .eq("id", id);

  if (updateStopError) return { error: updateStopError.message };

  // Editing stop trailer is not "became current" — no history row.
  const sync = await syncCurrentTrailerFromStops(supabase, stop.load_id, {
    recordHistory: false,
  });
  if (sync.error) return { error: sync.error };

  revalidatePath("/home");
  revalidatePath("/loads");
  revalidatePath(`/loads/${stop.load_id}`);
  revalidatePath(`/loads/${stop.load_id}/edit`);
  return { success: "Trailer updated." };
}

/**
 * Mark load complete: pay amount optional; ending mileage when starting was set
 * or load_date is today. Check all stops, clear current trailer, set status
 * completed + completed_at, then auto-activate oldest pending.
 */
export async function completeLoad(
  loadId: string,
  input?: { endingMileage?: number | null; payAmount?: number | null },
): Promise<LoadActionState> {
  const { supabase, error, user } = await requireWriter();
  if (error || !user) return { error: error ?? "Sign in to manage loads." };

  const id = loadId.trim();
  if (!id) return { error: "Missing load." };

  const endingRaw = input?.endingMileage;
  const endingMileage =
    endingRaw != null && Number.isFinite(Number(endingRaw))
      ? Number(endingRaw)
      : null;

  let payAmount: number | null = null;
  if (input?.payAmount != null) {
    const pay = Number(input.payAmount);
    if (!Number.isFinite(pay) || pay < 0) {
      return { error: "Enter a valid pay amount." };
    }
    payAmount = pay;
  }

  const { data: load, error: loadError } = await supabase
    .from("loads")
    .select("id, status, assigned_driver_id, starting_mileage, load_date")
    .eq("id", id)
    .eq("assigned_driver_id", user.id)
    .maybeSingle();

  if (loadError || !load) {
    return { error: loadError?.message ?? "Load not found." };
  }
  if (load.status !== "active") {
    return { error: "Only active loads can be completed." };
  }

  const endingRequired = isEndingMileageRequired(
    load.load_date,
    load.starting_mileage != null ? Number(load.starting_mileage) : null,
  );
  if (endingRequired && endingMileage == null) {
    return { error: "Ending mileage is required." };
  }
  if (
    endingMileage != null &&
    load.starting_mileage != null &&
    endingMileage < Number(load.starting_mileage)
  ) {
    return {
      error: "Ending mileage must be greater than or equal to starting mileage.",
    };
  }

  const departedAt = new Date().toISOString();

  const { error: stampError } = await supabase
    .from("load_stops")
    .update({ arrived_at: departedAt })
    .eq("load_id", id)
    .is("arrived_at", null);

  if (stampError) return { error: stampError.message };

  const { error: stopsError } = await supabase
    .from("load_stops")
    .update({ completed: true })
    .eq("load_id", id);

  if (stopsError) return { error: stopsError.message };

  const patch: {
    status: "completed";
    trailer_number: null;
    ending_mileage: number | null;
    completed_at: string;
    pay_amount?: number;
  } = {
    status: "completed",
    trailer_number: null,
    ending_mileage: endingMileage,
    completed_at: departedAt,
  };
  if (payAmount != null) {
    patch.pay_amount = payAmount;
  }

  const { error: updateError } = await supabase
    .from("loads")
    .update(patch)
    .eq("id", id)
    .eq("assigned_driver_id", user.id);

  if (updateError) return { error: updateError.message };

  // Promote oldest pending load for this driver to active.
  if (load.assigned_driver_id) {
    const { data: nextPending } = await supabase
      .from("loads")
      .select("id")
      .eq("assigned_driver_id", load.assigned_driver_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextPending) {
      const { error: promoteError } = await supabase
        .from("loads")
        .update({ status: "active" })
        .eq("id", nextPending.id)
        .eq("status", "pending");

      if (promoteError) {
        return {
          error: isOneActiveLoadViolation(promoteError.message)
            ? ONE_ACTIVE_LOAD_MESSAGE
            : promoteError.message,
        };
      }

      await syncCurrentTrailerFromStops(supabase, nextPending.id);
      revalidatePath(`/loads/${nextPending.id}`);
    }
  }

  revalidatePath("/home");
  revalidatePath("/loads");
  revalidatePath(`/loads/${id}`);
  return { success: "Load completed." };
}

/**
 * Archive an active (or pending) load: close out without counting toward stats.
 * Clears current trailer and promotes oldest pending, same as complete.
 */
export async function archiveLoad(loadId: string): Promise<LoadActionState> {
  const { supabase, error, user } = await requireWriter();
  if (error || !user) return { error: error ?? "Sign in to manage loads." };

  const id = loadId.trim();
  if (!id) return { error: "Missing load." };

  const { data: load, error: loadError } = await supabase
    .from("loads")
    .select("id, status, assigned_driver_id")
    .eq("id", id)
    .eq("assigned_driver_id", user.id)
    .maybeSingle();

  if (loadError || !load) {
    return { error: loadError?.message ?? "Load not found." };
  }
  if (load.status === "archived") {
    return { success: "Load already archived." };
  }
  if (load.status === "completed" || load.status === "cancelled") {
    return { error: "Completed or cancelled loads cannot be archived." };
  }

  const wasActive = load.status === "active";

  const { error: updateError } = await supabase
    .from("loads")
    .update({
      status: "archived",
      trailer_number: null,
      archived_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("assigned_driver_id", user.id);

  if (updateError) return { error: updateError.message };

  if (wasActive && load.assigned_driver_id) {
    const { data: nextPending } = await supabase
      .from("loads")
      .select("id")
      .eq("assigned_driver_id", load.assigned_driver_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextPending) {
      const { error: promoteError } = await supabase
        .from("loads")
        .update({ status: "active" })
        .eq("id", nextPending.id)
        .eq("status", "pending");

      if (promoteError) {
        return {
          error: isOneActiveLoadViolation(promoteError.message)
            ? ONE_ACTIVE_LOAD_MESSAGE
            : promoteError.message,
        };
      }

      await syncCurrentTrailerFromStops(supabase, nextPending.id);
      revalidatePath(`/loads/${nextPending.id}`);
    }
  }

  revalidatePath("/home");
  revalidatePath("/loads");
  revalidatePath(`/loads/${id}`);
  revalidatePath(`/loads/${id}/edit`);
  return { success: "Load archived." };
}

/**
 * Hard-delete an archived load. Must archive first.
 */
export async function deleteLoad(loadId: string): Promise<LoadActionState> {
  const { supabase, error, user } = await requireWriter();
  if (error || !user) return { error: error ?? "Sign in to manage loads." };

  const id = loadId.trim();
  if (!id) return { error: "Missing load." };

  const { data: load, error: loadError } = await supabase
    .from("loads")
    .select("id, status")
    .eq("id", id)
    .eq("assigned_driver_id", user.id)
    .maybeSingle();

  if (loadError || !load) {
    return { error: loadError?.message ?? "Load not found." };
  }
  if (load.status !== "archived") {
    return { error: "Archive the load before deleting." };
  }

  const { error: deleteError } = await supabase
    .from("loads")
    .delete()
    .eq("id", id)
    .eq("assigned_driver_id", user.id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/home");
  revalidatePath("/loads");
  redirect("/loads");
}

/** Update pay amount on a completed load (editable for 20 days after completion). */
export async function updateLoadPayAmount(
  loadId: string,
  payAmount: number,
): Promise<LoadActionState> {
  const { supabase, error, user } = await requireWriter();
  if (error || !user) return { error: error ?? "Sign in to manage loads." };

  if (!Number.isFinite(payAmount) || payAmount < 0) {
    return { error: "Enter a valid pay amount." };
  }

  const id = loadId.trim();
  if (!id) return { error: "Missing load." };

  const { data: load, error: loadError } = await supabase
    .from("loads")
    .select("id, status, completed_at, updated_at")
    .eq("id", id)
    .eq("assigned_driver_id", user.id)
    .maybeSingle();

  if (loadError || !load) {
    return { error: loadError?.message ?? "Load not found." };
  }
  if (load.status !== "completed") {
    return { error: "Pay amount can only be edited on completed loads." };
  }
  if (!isPayAmountEditable(load.completed_at, load.updated_at)) {
    return {
      error: `Pay amount is locked after ${PAY_AMOUNT_EDIT_DAYS} days from completion.`,
    };
  }

  const { error: updateError } = await supabase
    .from("loads")
    .update({ pay_amount: payAmount })
    .eq("id", id)
    .eq("assigned_driver_id", user.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/home");
  revalidatePath("/loads");
  revalidatePath(`/loads/${id}`);
  return { success: "Pay amount updated." };
}
