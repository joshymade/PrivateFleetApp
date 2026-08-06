/**
 * Unpaid Miles Driven (concept): driven − paid.
 * Display sign flips for emphasis: show paid − driven so more driven
 * appears as a red negative, more paid as a green positive.
 */

export function unpaidMilesDisplay(
  drivenMiles: number,
  paidMiles: number,
): number {
  return paidMiles - drivenMiles;
}

export function formatMilesNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Signed miles for UI (includes minus for negatives). */
export function formatSignedMiles(n: number): string {
  const abs = formatMilesNumber(Math.abs(n));
  if (n < 0) return `-${abs}`;
  if (n > 0) return abs;
  return "0";
}

export function formatSignedMilesLabel(n: number): string {
  return `${formatSignedMiles(n)} mi`;
}

/**
 * Red when more driven than paid (negative display),
 * green when more paid than driven (positive display).
 */
export function unpaidMilesToneClass(displayValue: number): string {
  if (displayValue < 0) {
    return "text-red-600 dark:text-red-400";
  }
  if (displayValue > 0) {
    return "text-emerald-700 dark:text-emerald-400";
  }
  return "text-muted-foreground";
}

/** Chart fills matching unpaid tone (CSS color values for Recharts). */
export function unpaidMilesChartColor(displayValue: number): string {
  if (displayValue < 0) return "#dc2626";
  if (displayValue > 0) return "#059669";
  return "var(--color-muted-foreground)";
}

export type UnpaidMilesPieSlice = {
  name: string;
  value: number;
  color: string;
  /** True for the unpaid / difference slice. */
  isUnpaid: boolean;
};

/**
 * Three-slice pie: Paid Miles, Miles Driven, and |unpaid| difference.
 * Of Paid vs Driven, larger first; Unpaid Miles always last.
 * Unpaid fill is red when driven > paid, green when paid > driven.
 */
export function buildUnpaidMilesPieSlices(
  drivenMiles: number,
  paidMiles: number,
): UnpaidMilesPieSlice[] {
  if (drivenMiles <= 0 && paidMiles <= 0) return [];

  const display = unpaidMilesDisplay(drivenMiles, paidMiles);
  const delta = Math.abs(display);

  const paidSlice: UnpaidMilesPieSlice = {
    name: "Paid Miles",
    value: paidMiles,
    color: "var(--color-accent)",
    isUnpaid: false,
  };
  const drivenSlice: UnpaidMilesPieSlice = {
    name: "Miles Driven",
    value: drivenMiles,
    color: "var(--color-brand)",
    isUnpaid: false,
  };

  const primary =
    paidMiles >= drivenMiles
      ? [paidSlice, drivenSlice]
      : [drivenSlice, paidSlice];

  const slices = [...primary];
  if (delta >= 1e-9) {
    slices.push({
      name: "Unpaid Miles",
      value: delta,
      color: unpaidMilesChartColor(display),
      isUnpaid: true,
    });
  }

  return slices.filter((s) => s.value > 0);
}
