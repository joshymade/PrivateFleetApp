"use server";

/** @deprecated Prefer @/app/(app)/account/actions — kept for existing imports. */
export {
  markNotificationRead,
  markAllNotificationsRead,
  updateProfileName,
  updateProfileWorkState,
  updateAdminContactEmail,
  contactAdminAboutIdentity,
  type ActionResult,
} from "@/app/(app)/account/actions";
