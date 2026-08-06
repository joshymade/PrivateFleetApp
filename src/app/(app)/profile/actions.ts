"use server";

/** @deprecated Prefer @/app/(app)/account/actions — kept for existing imports. */
export {
  markNotificationRead,
  markAllNotificationsRead,
  updateProfileName,
  updateProfileWorkState,
  contactAdminAboutIdentity,
  type ActionResult,
} from "@/app/(app)/account/actions";
