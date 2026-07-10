/**
 * Tractor numbers: up to 6 digits, optional hyphen display like `22-1234`.
 * Digits only count toward the max; non-digits are stripped for validation.
 */

export const TRACTOR_NUMBER_PLACEHOLDER = "22-1234";
export const TRACTOR_MAX_DIGITS = 6;

/** Keep only digits, capped at TRACTOR_MAX_DIGITS. */
export function tractorDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, TRACTOR_MAX_DIGITS);
}

/**
 * Format for display: `##-####` when 3+ digits, else raw digits.
 * Example: 221234 → 22-1234
 */
export function formatTractorNumber(raw: string): string {
  const digits = tractorDigits(raw);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

/** True when exactly 6 digits (hyphen optional in input). */
export function isValidTractorNumber(raw: string): boolean {
  return tractorDigits(raw).length === TRACTOR_MAX_DIGITS;
}
