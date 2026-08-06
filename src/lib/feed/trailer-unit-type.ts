import type { AssetType } from "@/types/database";

export type TrailerUnitKind = "dry_van" | "reefer";

/**
 * Classify trailer equipment from number prefix (trim; first character).
 * 1/2 → dry van, 3 → reefer; otherwise null (keep generic "Trailer").
 */
export function trailerUnitKindFromNumber(
  assetNumber: string | null | undefined,
): TrailerUnitKind | null {
  const trimmed = (assetNumber ?? "").trim();
  if (!trimmed) return null;
  const first = trimmed[0];
  if (first === "1" || first === "2") return "dry_van";
  if (first === "3") return "reefer";
  return null;
}

export function trailerUnitKindLabel(kind: TrailerUnitKind): string {
  return kind === "dry_van" ? "Dry Van" : "Reefer";
}

/** Type text before the unit number in feed report titles. */
export function feedReportAssetLabel(
  assetType: AssetType,
  assetNumber: string,
): string {
  if (assetType === "tractor") return "Tractor";
  const kind = trailerUnitKindFromNumber(assetNumber);
  if (kind) return trailerUnitKindLabel(kind);
  return "Trailer";
}

/**
 * Brand gold for unit numbers in feed / report / unit-history titles
 * (Texas gold `--accent` in both light and dark).
 */
export const feedUnitNumberClassName = "font-bold text-accent";

/**
 * Whether this trailer has a typed kind (Dry Van / Reefer) from its number prefix.
 */
export function isTypedTrailerNumber(
  assetType: AssetType,
  assetNumber: string,
): boolean {
  return (
    assetType === "trailer" && trailerUnitKindFromNumber(assetNumber) != null
  );
}
