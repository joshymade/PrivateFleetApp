import type { NotificationType } from "@/types/database";

/** Unread types that badge the driver Feed tab. */
export const FEED_NOTIFICATION_TYPES: NotificationType[] = [
  "report_noticed",
  "report_comment",
  "inbox_status",
];

/** Unread types that badge Safety's Feed (`/safety/inbox`). */
export const SAFETY_FEED_NOTIFICATION_TYPES: NotificationType[] = [
  "inbox_referral",
];

/** Driver Feed badge types (notice / comment reply / Safety viewed). */
export const DRIVER_FEED_BADGE_TYPES: NotificationType[] = [
  ...FEED_NOTIFICATION_TYPES,
];

/** Admin Feed also surfaces Safety referral alerts on `/feed`. */
export const ADMIN_FEED_BADGE_TYPES: NotificationType[] = [
  ...FEED_NOTIFICATION_TYPES,
  ...SAFETY_FEED_NOTIFICATION_TYPES,
];
