/**
 * Trailer damage location checkboxes on Report create.
 * Stored as stable keys in damage_reports.damage_locations (text[]).
 */

export const DAMAGE_LOCATION_OPTIONS = [
  { value: "front_of_trailer", label: "Front of trailer" },
  { value: "rear_of_trailer", label: "Rear of trailer" },
  { value: "undercarriage", label: "Undercarriage" },
  { value: "tandems", label: "Tandems" },
  { value: "driver_sidewall", label: "Driver sidewall" },
  { value: "passenger_side_wall", label: "Passenger side wall" },
  { value: "top_of_trailer", label: "Top of trailer" },
] as const;

export type DamageLocationValue =
  (typeof DAMAGE_LOCATION_OPTIONS)[number]["value"];

const LABEL_BY_VALUE = Object.fromEntries(
  DAMAGE_LOCATION_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DamageLocationValue, string>;

const VALUE_SET = new Set<string>(
  DAMAGE_LOCATION_OPTIONS.map((o) => o.value),
);

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
  return sanitizeDamageLocations(values).map(
    (v) => LABEL_BY_VALUE[v],
  );
}
