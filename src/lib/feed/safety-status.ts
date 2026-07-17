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

/** Red for Notified / Viewed so they stand out; Dismissed stays muted. */
export function safetyInboxStatusClassName(
  status: SafetyInboxStatus | null | undefined,
): string {
  if (status === "pending" || status === "reviewed") {
    return "text-destructive";
  }
  return "text-muted-foreground";
}
