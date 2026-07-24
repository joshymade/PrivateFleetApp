/** Fleet regions drivers and Safety are assigned to (1–6). */
export const FLEET_REGIONS = [1, 2, 3, 4, 5, 6] as const;

export type FleetRegion = (typeof FLEET_REGIONS)[number];

export function isFleetRegion(value: unknown): value is FleetRegion {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6
  );
}

export function parseFleetRegion(raw: string | number | null | undefined): FleetRegion | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return isFleetRegion(n) ? n : null;
}

export function formatFleetRegion(region: number | null | undefined): string {
  if (region == null) return "—";
  return `Region ${region}`;
}
