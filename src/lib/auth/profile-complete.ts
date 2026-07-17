import { parseFullName } from "@/lib/profile-name";
import { isUsStateCode } from "@/lib/us-states";
import type { Profile, UserRole } from "@/types/database";

/** Fields required before a driver can report damage or manage loads. */
export type ProfileCompletenessFields = Pick<
  Profile,
  "full_name" | "work_state"
> | null;

/**
 * Profile is complete when first name and a valid USPS work_state are set.
 * Last initial is optional. `driver_id` alone is not enough.
 */
export function isProfileComplete(
  profile: ProfileCompletenessFields,
): boolean {
  if (!profile) return false;
  const { firstName } = parseFullName(profile.full_name);
  if (!firstName) return false;
  const state = profile.work_state?.trim().toUpperCase() ?? "";
  return isUsStateCode(state);
}

/** Drivers must finish profile setup; safety/admin are not gated. */
export function driverNeedsProfileSetup(
  role: UserRole,
  profile: ProfileCompletenessFields,
): boolean {
  return role === "driver" && !isProfileComplete(profile);
}

export const PROFILE_SETUP_PATH = "/account?setup=1";

export const PROFILE_INCOMPLETE_MESSAGE =
  "Complete your profile (first name and work state) before continuing.";
