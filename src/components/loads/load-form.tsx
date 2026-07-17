"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { StopTrailerField } from "@/components/loads/stop-trailer-field";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";
import {
  createLoad,
  updateLoad,
  type LoadActionState,
} from "@/lib/loads/actions";
import { todayDateString } from "@/lib/loads/date";
import type { Load, LoadStop, LoadStopType } from "@/types/database";

const initial: LoadActionState = {};

const TRUCK_NUMBER_HELP =
  "Set your current truck number in Account settings. It is applied to every new load until you change it.";

const STOP_TYPE_OPTIONS: { value: LoadStopType; label: string }[] = [
  { value: "store", label: "Store" },
  { value: "vendor", label: "Vendor" },
  { value: "dc", label: "DC" },
];

type StopDraft = {
  /** Present for existing stops in edit mode — enables quick trailer save. */
  id?: string;
  stop_type: LoadStopType;
  stop_name: string;
  pickup_number: string;
  trailer_number: string;
};

function emptyStop(): StopDraft {
  return {
    stop_type: "store",
    stop_name: "",
    pickup_number: "",
    trailer_number: "",
  };
}

export function LoadForm({
  mode,
  load,
  stops = [],
  defaultDate,
  hasActiveLoad = false,
  currentTruckNumber = null,
}: {
  mode: "create" | "edit";
  load?: Load;
  stops?: LoadStop[];
  defaultDate?: string;
  /** When creating while an active load exists, new load will be pending. */
  hasActiveLoad?: boolean;
  /** Profile current truck; create mode shows read-only context + Account link. */
  currentTruckNumber?: string | null;
}) {
  const action = mode === "create" ? createLoad : updateLoad;
  const [state, formAction, pending] = useActionState(action, initial);
  const [stopRows, setStopRows] = useState<StopDraft[]>(() =>
    stops.length > 0
      ? stops
          .slice()
          .sort((a, b) => a.delivery_order - b.delivery_order)
          .map((s) => ({
            id: s.id,
            stop_type: s.stop_type ?? "store",
            stop_name: s.stop_name,
            pickup_number: s.pickup_number ?? "",
            trailer_number: s.trailer_number ?? "",
          }))
      : [emptyStop()],
  );

  function updateStop(index: number, patch: Partial<StopDraft>) {
    setStopRows((rows) => {
      const next = [...rows];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  const truckDisplay = currentTruckNumber?.trim() || null;

  return (
    <form action={formAction} className="space-y-4">
      {mode === "edit" && load ? (
        <input type="hidden" name="load_id" value={load.id} />
      ) : null}

      {mode === "create" && hasActiveLoad ? (
        <p className="rounded-xl border border-border bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          You already have an active load. This new load will stay{" "}
          <span className="font-medium text-foreground">pending</span> until
          that load is completed.
        </p>
      ) : null}

      {mode === "create" ? (
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-muted-foreground">Truck</span>
            <span className="font-medium tabular-nums text-foreground">
              {truckDisplay ?? "Not set"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Link
                href="/account#truck-settings"
                className="font-medium text-brand underline-offset-2 hover:underline"
              >
                {truckDisplay ? "Change truck number" : "Set truck number"}
              </Link>
              <ClickableTooltip
                ariaLabel="Why set your truck number"
                className="text-muted-foreground"
                content={TRUCK_NUMBER_HELP}
              >
                <span className="sr-only">About truck number</span>
              </ClickableTooltip>
            </span>
          </div>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">Load number</span>
        <input
          name="load_number"
          required
          defaultValue={load?.load_number ?? ""}
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">Date</span>
          <input
            type="date"
            name="load_date"
            required
            defaultValue={load?.load_date ?? defaultDate ?? todayDateString()}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">
            Paid miles
          </span>
          <input
            name="paid_miles"
            inputMode="decimal"
            required
            defaultValue={load?.paid_miles ?? ""}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">
            Starting mileage
          </span>
          <input
            name="starting_mileage"
            inputMode="decimal"
            required
            defaultValue={load?.starting_mileage ?? ""}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </label>
        {mode === "edit" ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">
              Ending mileage
            </span>
            <input
              name="ending_mileage"
              inputMode="decimal"
              defaultValue={load?.ending_mileage ?? ""}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>
        ) : (
          <div className="block text-sm text-muted-foreground">
            <span className="mb-1 block font-medium text-foreground">
              Ending mileage
            </span>
            <p className="mt-2 text-xs">Entered when you complete the load.</p>
          </div>
        )}
      </div>

      {mode === "edit" ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">
            Pay amount ($)
          </span>
          <input
            name="pay_amount"
            inputMode="decimal"
            defaultValue={load?.pay_amount ?? ""}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </label>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">Route #</span>
        <input
          name="route_number"
          defaultValue={load?.route_number ?? ""}
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">Stops</legend>
        {stopRows.map((row, index) => (
          <div
            key={index}
            className="space-y-3 rounded-xl border border-border bg-card p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Stop {index + 1}
              </span>
              {stopRows.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setStopRows((rows) => rows.filter((_, i) => i !== index))
                  }
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div
              role="radiogroup"
              aria-label={`Stop ${index + 1} type`}
              className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
            >
              {STOP_TYPE_OPTIONS.map((opt) => {
                const selected = row.stop_type === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex min-h-10 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                      selected
                        ? "bg-brand text-white shadow-sm dark:bg-brand dark:text-background"
                        : "text-muted-foreground active:bg-background/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`stop_type_ui_${index}`}
                      value={opt.value}
                      checked={selected}
                      onChange={() => updateStop(index, { stop_type: opt.value })}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
            {/* Parallel arrays for FormData — one hidden per stop row */}
            <input type="hidden" name="stop_type" value={row.stop_type} />

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">
                Stop name
              </span>
              <input
                name="stop_name"
                placeholder="e.g. Walmart #1234"
                value={row.stop_name}
                onChange={(e) => updateStop(index, { stop_name: e.target.value })}
                className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">
                Pickup number
              </span>
              <input
                name="pickup_number"
                placeholder="Pickup #"
                value={row.pickup_number}
                onChange={(e) =>
                  updateStop(index, { pickup_number: e.target.value })
                }
                className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>

            {row.id ? (
              <>
                <input
                  type="hidden"
                  name="stop_trailer_number"
                  value={row.trailer_number}
                />
                <StopTrailerField
                  key={row.id}
                  stopId={row.id}
                  trailerNumber={row.trailer_number || null}
                  canEdit
                  variant="form"
                  onSaved={(next) =>
                    updateStop(index, { trailer_number: next ?? "" })
                  }
                />
              </>
            ) : (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">
                  Trailer at this stop{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </span>
                <input
                  name="stop_trailer_number"
                  placeholder="Trailer picked up here"
                  value={row.trailer_number}
                  onChange={(e) =>
                    updateStop(index, { trailer_number: e.target.value })
                  }
                  autoComplete="off"
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Current trailer updates when you mark this stop Departed.
                </span>
              </label>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setStopRows((rows) => [...rows, emptyStop()])}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-4 text-sm font-semibold text-brand outline-none transition-colors hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-accent/60 dark:border-brand/50 dark:bg-brand/20 dark:hover:bg-brand/25"
        >
          <Plus className="size-4 shrink-0" aria-hidden />
          Add stop
        </button>
      </fieldset>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {state.success}
        </p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create load"
              : "Save changes"}
        </button>
        <Link
          href={mode === "edit" && load ? `/loads/${load.id}` : "/loads"}
          className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
