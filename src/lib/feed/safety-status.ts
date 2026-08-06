import type { SafetyInboxStatus } from "@/types/database";

/**
 * Driver-facing tag for a report’s safety inbox referral status.
 * Derived from `safety_inbox_items.status` when a referral exists;
 * otherwise defaults to "safety not notified".
 */
export function safetyInboxStatusLabel(
  status: SafetyInboxStatus | null | undefined,
): string {
  if (status === "pending") return "Safety Notified";
  if (status === "reviewed") return "Safety Viewed";
  if (status === "dismissed") return "Safety Dismissed";
  return "safety not notified";
}

/** All safety status tags use red so they stand out on feed cards and detail. */
export function safetyInboxStatusClassName(
  _status?: SafetyInboxStatus | null,
): string {
  return "text-destructive";
}
