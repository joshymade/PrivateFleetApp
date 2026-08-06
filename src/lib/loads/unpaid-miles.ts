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
 * Two-slice pie: matched miles + |unpaid| difference.
 * When driven > paid: Paid + Unpaid (red). When paid > driven: Driven + Unpaid (green).
 */
export function buildUnpaidMilesPieSlices(
  drivenMiles: number,
  paidMiles: number,
): UnpaidMilesPieSlice[] {
  const display = unpaidMilesDisplay(drivenMiles, paidMiles);
  const matched = Math.min(drivenMiles, paidMiles);
  const delta = Math.abs(display);

  if (drivenMiles <= 0 && paidMiles <= 0) return [];

  if (delta < 1e-9) {
    return [
      {
        name: "Paid = Driven",
        value: matched > 0 ? matched : drivenMiles || paidMiles,
        color: "var(--color-brand)",
        isUnpaid: false,
      },
    ];
  }

  if (display < 0) {
    // More driven than paid — unpaid shortfall (red)
    return [
      {
        name: "Paid miles",
        value: matched,
        color: "var(--color-accent)",
        isUnpaid: false,
      },
      {
        name: "Unpaid miles",
        value: delta,
        color: unpaidMilesChartColor(display),
        isUnpaid: true,
      },
    ].filter((s) => s.value > 0);
  }

  // More paid than driven — surplus shown as green unpaid slice
  return [
    {
      name: "Driven miles",
      value: matched,
      color: "var(--color-brand)",
      isUnpaid: false,
    },
    {
      name: "Unpaid miles",
      value: delta,
      color: unpaidMilesChartColor(display),
      isUnpaid: true,
    },
  ].filter((s) => s.value > 0);
}
