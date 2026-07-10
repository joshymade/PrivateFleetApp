"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  driverNeedsProfileSetup,
  PROFILE_INCOMPLETE_MESSAGE,
} from "@/lib/auth/profile-complete";
import { createClient } from "@/lib/supabase/server";
import { todayDateString } from "@/lib/loads/date";
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
  const milesRaw = String(formData.get("assigned_miles") ?? "").trim();
  const assignedMiles = milesRaw ? Number(milesRaw) : null;
  const assignedDriverRaw = String(
    formData.get("assigned_driver_id") ?? "",
  ).trim();
  const assignedDriverId = assignedDriverRaw || user.id;

  const { stops, error: stopsParseError } = parseStops(formData);
  if (stopsParseError) return { error: stopsParseError };

  if (!loadNumber) {
    return { error: "Load number is required." };
  }
  if (milesRaw && Number.isNaN(assignedMiles)) {
    return { error: "Miles must be a number." };
  }

  const existingActive = await findActiveLoadConflict(
    supabase,
    assignedDriverId,
  );
  // Queue behind the active load; never create a second active.
  const status = existingActive ? "pending" : "active";

  const { data: load, error: insertError } = await supabase
    .from("loads")
    .insert({
      load_number: loadNumber,
      starting_trailer_number: null,
      trailer_number: null,
      route_number: routeNumber,
      load_date: loadDate,
      assigned_miles: assignedMiles,
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
  const milesRaw = String(formData.get("assigned_miles") ?? "").trim();
  const assignedMiles = milesRaw ? Number(milesRaw) : null;
  const assignedDriverRaw = String(
    formData.get("assigned_driver_id") ?? "",
  ).trim();

  const { stops, error: stopsParseError } = parseStops(formData);
  if (stopsParseError) return { error: stopsParseError };

  if (!loadNumber || !loadDate) {
    return { error: "Load number and date are required." };
  }

  const patch: Record<string, unknown> = {
    load_number: loadNumber,
    route_number: routeNumber,
    load_date: loadDate,
    assigned_miles: assignedMiles,
  };
  if (assignedDriverRaw) {
    patch.assigned_driver_id = assignedDriverRaw;

    const { data: current } = await supabase
      .from("loads")
      .select("status")
      .eq("id", loadId)
      .maybeSingle();

    // Reassigning an active load must not give the target a second active load.
    if (current?.status === "active") {
      const conflict = await findActiveLoadConflict(
        supabase,
        assignedDriverRaw,
        loadId,
      );
      if (conflict) {
        return {
          error: `That driver already has an active load (Load #${conflict.load_number}). Complete it before assigning another.`,
        };
      }
    }
  }

  const { error: updateError } = await supabase
    .from("loads")
    .update(patch)
    .eq("id", loadId);

  if (updateError) {
    return {
      error: isOneActiveLoadViolation(updateError.message)
        ? "That driver already has an active load. Complete it before assigning another."
        : updateError.message,
    };
  }

  // Preserve completed flags by delivery_order before replacing stop rows.
  const { data: priorStops } = await supabase
    .from("load_stops")
    .select("delivery_order, completed")
    .eq("load_id", loadId);
  const completedByOrder = new Map(
    (priorStops ?? []).map((s) => [s.delivery_order, s.completed]),
  );

  await supabase.from("load_stops").delete().eq("load_id", loadId);
  if (stops.length > 0) {
    const { error: stopsError } = await supabase.from("load_stops").insert(
      stops.map((s, i) => ({
        load_id: loadId,
        stop_type: s.stop_type,
        stop_name: s.stop_name,
        pickup_number: s.pickup_number,
        trailer_number: s.trailer_number,
        delivery_order: i + 1,
        completed: completedByOrder.get(i + 1) ?? false,
      })),
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
 * Toggle stop completed (strikethrough). Current trailer always recomputes from
 * the last checked stop with a trailer (check or uncheck).
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
    .select("id, load_id, trailer_number, completed")
    .eq("id", id)
    .maybeSingle();

  if (stopError || !stop) {
    return { error: stopError?.message ?? "Stop not found." };
  }

  const { error: updateStopError } = await supabase
    .from("load_stops")
    .update({ completed })
    .eq("id", id);

  if (updateStopError) return { error: updateStopError.message };

  const sync = await syncCurrentTrailerFromStops(supabase, stop.load_id);
  if (sync.error) return { error: sync.error };

  revalidatePath("/home");
  revalidatePath("/loads");
  revalidatePath(`/loads/${stop.load_id}`);
  return { success: completed ? "Stop marked done." : "Stop unmarked." };
}

/**
 * Mark load complete: check all stops, clear current trailer, set status completed,
 * then auto-activate the oldest pending load for the same driver (if any).
 */
export async function completeLoad(loadId: string): Promise<LoadActionState> {
  const { supabase, error, user } = await requireWriter();
  if (error || !user) return { error: error ?? "Sign in to manage loads." };

  const id = loadId.trim();
  if (!id) return { error: "Missing load." };

  const { data: load, error: loadError } = await supabase
    .from("loads")
    .select("id, status, assigned_driver_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !load) {
    return { error: loadError?.message ?? "Load not found." };
  }
  if (load.status !== "active") {
    return { error: "Only active loads can be completed." };
  }

  const { error: stopsError } = await supabase
    .from("load_stops")
    .update({ completed: true })
    .eq("load_id", id);

  if (stopsError) return { error: stopsError.message };

  const { error: updateError } = await supabase
    .from("loads")
    .update({ status: "completed", trailer_number: null })
    .eq("id", id);

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

      // Align current trailer with any already-checked stops on the new active.
      await syncCurrentTrailerFromStops(supabase, nextPending.id);
      revalidatePath(`/loads/${nextPending.id}`);
    }
  }

  revalidatePath("/home");
  revalidatePath("/loads");
  revalidatePath(`/loads/${id}`);
  return { success: "Load completed." };
}
