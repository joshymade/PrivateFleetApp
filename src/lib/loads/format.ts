import type {
  Load,
  LoadStop,
  LoadStopType,
  LoadTrailerHistory,
} from "@/types/database";

export type LoadWithStopsLite = Load & {
  load_stops: LoadStop[];
};

function dedupeConsecutive(trailers: string[]): string[] {
  const out: string[] = [];
  for (const t of trailers) {
    if (!t) continue;
    if (out.length === 0 || out[out.length - 1] !== t) out.push(t);
  }
  return out;
}

/**
 * Current trailer from checked stops: last completed stop (by delivery_order)
 * with a non-empty trailer_number. Null when none.
 */
export function resolveCurrentTrailerFromStops(
  stops: Pick<LoadStop, "trailer_number" | "delivery_order" | "completed">[],
): string | null {
  const ordered = [...stops].sort((a, b) => a.delivery_order - b.delivery_order);
  let current: string | null = null;
  for (const stop of ordered) {
    if (!stop.completed) continue;
    const t = stop.trailer_number?.trim();
    if (t) current = t;
  }
  return current;
}

/**
 * Current stop for Home quick view: first stop not yet departed
 * (`completed === false`), by delivery_order. When all are departed, returns
 * the last departed stop with `allDeparted: true`.
 */
export function resolveCurrentStop(
  stops: Pick<
    LoadStop,
    | "id"
    | "stop_type"
    | "stop_name"
    | "pickup_number"
    | "seal_record"
    | "pallet_count"
    | "position_count"
    | "trailer_number"
    | "delivery_order"
    | "completed"
  >[],
): {
  stop: (typeof stops)[number] | null;
  allDeparted: boolean;
} {
  const ordered = [...stops].sort((a, b) => a.delivery_order - b.delivery_order);
  if (ordered.length === 0) return { stop: null, allDeparted: false };

  const next = ordered.find((s) => !s.completed);
  if (next) return { stop: next, allDeparted: false };

  return { stop: ordered[ordered.length - 1]!, allDeparted: true };
}

/**
 * Home Active Load: show Complete Load instead of Depart when at most one
 * undeparted stop remains (that stop is current / last by delivery_order),
 * or when every stop is already departed (edge case — load still active).
 */
export function shouldShowCompleteLoadOnHome(
  stops: Pick<LoadStop, "completed">[],
): boolean {
  const undepartedCount = stops.filter((s) => !s.completed).length;
  return undepartedCount <= 1;
}

/**
 * Trailer numbers for display: stop pickup trailers in delivery_order
 * (skip empty; dedupe consecutive). No separate starting-trailer field.
 *
 * Optional history / load args kept for call-site compatibility.
 */
export function trailerSequenceParts(
  _load: Partial<Pick<Load, "starting_trailer_number" | "trailer_number">>,
  stops: Pick<LoadStop, "trailer_number" | "delivery_order">[],
  _history?: Pick<LoadTrailerHistory, "trailer_number" | "changed_at">[],
): string[] {
  const parts: string[] = [];
  const orderedStops = [...stops].sort(
    (a, b) => a.delivery_order - b.delivery_order,
  );
  for (const stop of orderedStops) {
    const t = stop.trailer_number?.trim() ?? "";
    if (!t) continue;
    if (parts.length === 0 || parts[parts.length - 1] !== t) {
      parts.push(t);
    }
  }

  return dedupeConsecutive(parts);
}

/** Joins {@link trailerSequenceParts} with arrows for Trailer(s) fields. */
export function formatTrailerSequence(
  load: Partial<Pick<Load, "starting_trailer_number" | "trailer_number">>,
  stops: Pick<LoadStop, "trailer_number" | "delivery_order">[],
  history?: Pick<LoadTrailerHistory, "trailer_number" | "changed_at">[],
): string {
  const parts = trailerSequenceParts(load, stops, history);
  return parts.length > 0 ? parts.join(" → ") : "—";
}

/** User-facing title for a load number (does not alter stored `load_number`). */
export function formatLoadLabel(loadNumber: string): string {
  return `Load #${loadNumber}`;
}

export type RouteSnippetPart =
  | { kind: "stop"; name: string; stopType: LoadStopType }
  | { kind: "text"; text: string };

/** Tailwind text color for a stop name by `stop_type` (theme tokens). */
export function stopTypeNameClass(type: LoadStopType): string {
  switch (type) {
    case "store":
      return "text-brand";
    case "dc":
      return "text-accent";
    case "vendor":
      return "text-foreground";
  }
}

export function routeSnippetParts(load: LoadWithStopsLite): RouteSnippetPart[] {
  const stops = [...load.load_stops].sort(
    (a, b) => a.delivery_order - b.delivery_order,
  );
  if (stops.length === 0) {
    return [
      {
        kind: "text",
        text: load.route_number ? `Route ${load.route_number}` : "No stops",
      },
    ];
  }

  const named = stops
    .map((s) => {
      const name = s.stop_name?.trim();
      if (!name) return null;
      return {
        kind: "stop" as const,
        name,
        stopType: s.stop_type,
      };
    })
    .filter((p): p is Extract<RouteSnippetPart, { kind: "stop" }> => p != null);

  if (named.length > 0) return named;

  const pickups = stops
    .map((s) => s.pickup_number?.trim())
    .filter((text): text is string => Boolean(text));
  if (pickups.length > 0) {
    return pickups.map((text) => ({ kind: "text" as const, text }));
  }

  return [
    {
      kind: "text",
      text: load.route_number ? `Route ${load.route_number}` : "No stops",
    },
  ];
}

export function routeSnippet(load: LoadWithStopsLite): string {
  return routeSnippetParts(load)
    .map((p) => (p.kind === "stop" ? p.name : p.text))
    .join(" → ");
}

export function stopTypeLabel(type: LoadStopType): string {
  switch (type) {
    case "store":
      return "Store";
    case "vendor":
      return "Vendor";
    case "dc":
      return "DC";
  }
}

export function statusLabel(status: Load["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "pending":
      return "Pending";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "archived":
      return "Archived";
  }
}

/** Pill classes for load status chips (theme tokens for Active). */
export function statusBadgeClassName(status: Load["status"]): string {
  switch (status) {
    case "active":
      return "bg-accent/20 text-accent-foreground ring-1 ring-accent/40 dark:text-accent";
    case "pending":
      return "bg-muted text-muted-foreground ring-1 ring-border";
    case "completed":
      return "bg-muted text-foreground";
    case "cancelled":
      return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300";
    case "archived":
      return "bg-muted text-muted-foreground ring-1 ring-border";
  }
}
