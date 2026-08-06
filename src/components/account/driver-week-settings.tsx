"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  updateCurrentTruckNumber,
  updateDriverWeekPrefs,
} from "@/app/(app)/account/actions";
import { WEEKDAY_LABELS } from "@/lib/loads/date";
import {
  formatTractorNumber,
  TRACTOR_NUMBER_PLACEHOLDER,
} from "@/lib/tractor-number";

export function DriverWeekSettings({
  weekStartDay,
  offDays,
  currentTruckNumber,
}: {
  weekStartDay: number;
  offDays: number[];
  currentTruckNumber: string | null;
}) {
  const router = useRouter();
  const [startDay, setStartDay] = useState(weekStartDay);
  const [offs, setOffs] = useState<number[]>(offDays);
  const [truckNumber, setTruckNumber] = useState(
    currentTruckNumber?.trim() ?? "",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleOff(day: number) {
    setOffs((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      if (prev.length >= 4) return prev;
      return [...prev, day].sort((a, b) => a - b);
    });
    setSaved(false);
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const weekResult = await updateDriverWeekPrefs({
        weekStartDay: startDay,
        offDays: offs,
      });
      if (!weekResult.ok) {
        setError(weekResult.error);
        return;
      }

      const truckResult = await updateCurrentTruckNumber({
        currentTruckNumber: truckNumber,
      });
      if (!truckResult.ok) {
        setError(truckResult.error);
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div id="truck-settings" className="flex flex-col gap-4 scroll-mt-24">
      <div>
        <label
          htmlFor="current-truck-number"
          className="text-sm font-medium text-foreground"
        >
          Current truck number
        </label>
        <p id="current-truck-number-hint" className="mt-1 text-xs text-muted-foreground">
          Used on each new load until you change it. Leave blank to clear.
        </p>
        <input
          id="current-truck-number"
          value={truckNumber}
          onChange={(e) => {
            setTruckNumber(formatTractorNumber(e.target.value));
            setSaved(false);
          }}
          inputMode="numeric"
          autoComplete="off"
          placeholder={TRACTOR_NUMBER_PLACEHOLDER}
          maxLength={7}
          aria-describedby="current-truck-number-hint"
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <div>
        <label
          htmlFor="week-start-day"
          className="text-sm font-medium text-foreground"
        >
          Start of week
        </label>
        <p id="week-start-day-hint" className="mt-1 text-xs text-muted-foreground">
          Your work week cards begin on this day (for example Friday if that is
          your Monday).
        </p>
        <select
          id="week-start-day"
          value={startDay}
          onChange={(e) => {
            setStartDay(Number(e.target.value));
            setSaved(false);
          }}
          aria-describedby="week-start-day-hint"
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground"
        >
          {WEEKDAY_LABELS.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Off days</legend>
        <p id="off-days-hint" className="mt-1 text-xs text-muted-foreground">
          Mark your usual days off. You can still log loads on those days for
          overtime.
        </p>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-describedby="off-days-hint"
        >
          {WEEKDAY_LABELS.map((label, i) => {
            const selected = offs.includes(i);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleOff(i)}
                aria-pressed={selected}
                className={`min-h-10 rounded-xl px-3 text-sm font-medium ${
                  selected
                    ? "bg-brand text-white dark:text-background"
                    : "border border-border bg-background text-muted-foreground"
                }`}
              >
                {label.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>
      ) : null}

      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
