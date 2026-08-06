/**
 * Per-photo damage location tags on Report create.
 * Stored as stable keys on damage_report_photos.damage_location and
 * aggregated on damage_reports.damage_locations (text[]).
 */

import type { AssetType } from "@/types/database";

export const TRAILER_DAMAGE_LOCATION_OPTIONS = [
  { value: "front_of_trailer", label: "Front of trailer" },
  { value: "rear_of_trailer", label: "Rear of trailer" },
  { value: "undercarriage", label: "Undercarriage" },
  { value: "tandems", label: "Tandems" },
  { value: "driver_sidewall", label: "Driver sidewall" },
  { value: "passenger_side_wall", label: "Passenger side wall" },
  { value: "top_of_trailer", label: "Top of trailer" },
] as const;

export const TRACTOR_DAMAGE_LOCATION_OPTIONS = [
  { value: "interior_of_cab", label: "Interior of cab" },
  { value: "front_of_tractor", label: "Front of tractor" },
  { value: "driver_side_of_tractor", label: "Driver side of tractor" },
  { value: "rear_of_tractor", label: "Rear of tractor" },
  { value: "passenger_side_of_tractor", label: "Passenger side of tractor" },
  { value: "undercarriage", label: "Undercarriage" },
  { value: "roof", label: "Roof" },
] as const;

/** Alias kept for older imports; prefer TRAILER_ or damageLocationOptionsForAsset. */
export const DAMAGE_LOCATION_OPTIONS = TRAILER_DAMAGE_LOCATION_OPTIONS;

export type TrailerDamageLocationValue =
  (typeof TRAILER_DAMAGE_LOCATION_OPTIONS)[number]["value"];

export type TractorDamageLocationValue =
  (typeof TRACTOR_DAMAGE_LOCATION_OPTIONS)[number]["value"];

export type DamageLocationValue =
  | TrailerDamageLocationValue
  | TractorDamageLocationValue;

export type DamageLocationOption = {
  value: DamageLocationValue;
  label: string;
};

const ALL_DAMAGE_LOCATION_OPTIONS: readonly DamageLocationOption[] = [
  ...TRAILER_DAMAGE_LOCATION_OPTIONS,
  ...TRACTOR_DAMAGE_LOCATION_OPTIONS.filter(
    (o) =>
      !TRAILER_DAMAGE_LOCATION_OPTIONS.some((t) => t.value === o.value),
  ),
];

const LABEL_BY_VALUE = Object.fromEntries(
  ALL_DAMAGE_LOCATION_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DamageLocationValue, string>;

const VALUE_SET = new Set<string>(
  ALL_DAMAGE_LOCATION_OPTIONS.map((o) => o.value),
);

export function damageLocationOptionsForAsset(
  assetType: AssetType,
): readonly DamageLocationOption[] {
  return assetType === "tractor"
    ? TRACTOR_DAMAGE_LOCATION_OPTIONS
    : TRAILER_DAMAGE_LOCATION_OPTIONS;
}

export function isDamageLocationValue(raw: string): raw is DamageLocationValue {
  return VALUE_SET.has(raw);
}

export function sanitizeDamageLocations(
  values: readonly string[] | null | undefined,
): DamageLocationValue[] {
  if (!values?.length) return [];
  const seen = new Set<DamageLocationValue>();
  const out: DamageLocationValue[] = [];
  for (const raw of values) {
    if (!isDamageLocationValue(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

export function damageLocationLabel(value: string): string {
  if (isDamageLocationValue(value)) return LABEL_BY_VALUE[value];
  return value;
}

export function formatDamageLocationLabels(
  values: readonly string[] | null | undefined,
): string[] {
  return sanitizeDamageLocations(values).map((v) => LABEL_BY_VALUE[v]);
}
