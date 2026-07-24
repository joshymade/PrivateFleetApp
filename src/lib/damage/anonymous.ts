import { ANONYMOUS_DRIVER_PROFILE_ID } from "@/types/database";

export { ANONYMOUS_DRIVER_PROFILE_ID };

export function isAnonymousReporter(reportedBy: string | null | undefined) {
  return reportedBy === ANONYMOUS_DRIVER_PROFILE_ID;
}
