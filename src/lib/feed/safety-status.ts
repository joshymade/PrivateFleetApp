import type { SafetyInboxStatus } from "@/types/database";

/** Driver-facing tag for a report’s safety inbox referral status. */
export function safetyInboxStatusLabel(
  status: SafetyInboxStatus | null | undefined,
): string | null {
  if (status === "pending") return "Safety Notified";
  if (status === "reviewed") return "Safety Viewed";
  if (status === "dismissed") return "Safety Dismissed";
  return null;
}
