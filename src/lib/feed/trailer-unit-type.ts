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
  return kind === "dry_van" ? "dry van" : "reefer";
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
 * Whether this trailer should use theme brand/contrast number coloring
 * (`text-brand` light / `text-accent` dark via pageTitleColorClassName).
 */
export function isTypedTrailerNumber(
  assetType: AssetType,
  assetNumber: string,
): boolean {
  return (
    assetType === "trailer" && trailerUnitKindFromNumber(assetNumber) != null
  );
}
