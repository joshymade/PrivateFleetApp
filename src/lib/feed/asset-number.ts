import { formatTractorNumber, TRACTOR_MAX_DIGITS } from "@/lib/tractor-number";

/** Digits only from a trailer/tractor number (search + unit slug). */
export function assetNumberDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Stored `asset_number` values that equal these digits
 * (plain digits, or tractor `##-####` when 6 digits).
 */
export function assetNumberMatchValues(digits: string): string[] {
  if (!digits) return [];
  const values = new Set<string>([digits]);
  if (digits.length === TRACTOR_MAX_DIGITS) {
    values.add(formatTractorNumber(digits));
  }
  return [...values];
}

/** Canonical unit history path — slug is digits only. */
export function feedUnitHref(assetNumber: string, opts?: { page?: number }): string {
  const digits = assetNumberDigits(assetNumber);
  if (!digits) return "/feed";
  const base = `/feed/unit/${encodeURIComponent(digits)}`;
  if (opts?.page && opts.page > 1) {
    return `${base}?page=${opts.page}`;
  }
  return base;
}

/**
 * Display label for a unit page: prefer a stored formatted number from reports,
 * else format 6-digit as tractor style, else raw digits.
 */
export function displayAssetNumberFromReports(
  digits: string,
  storedNumbers: string[],
): string {
  const match = storedNumbers.find(
    (n) => assetNumberDigits(n) === digits && n.trim().length > 0,
  );
  if (match) return match.trim();
  if (digits.length === TRACTOR_MAX_DIGITS) {
    return formatTractorNumber(digits);
  }
  return digits;
}
