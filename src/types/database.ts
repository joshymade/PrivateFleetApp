/** Hand-typed row shapes until `supabase gen types` is wired. */

export type UserRole = "driver" | "safety" | "admin";

export type AssetType = "trailer" | "tractor";

export type Profile = {
  id: string;
  /** Company Driver ID; required for drivers, null for safety/admin. */
  driver_id: string | null;
  email: string | null;
  full_name: string | null;
  /** USPS 2-letter code for state worked out of; null if unset. */
  work_state: string | null;
  /** Legacy column; Home always shows "out of {State}" when work_state is set. */
  show_work_state_on_home: boolean;
  /**
   * Free post-setup edits to full_name / work_state for drivers.
   * Default 1; first-time setup does not consume; decremented by DB trigger.
   */
  identity_changes_remaining: number;
  /**
   * Admin inbox for driver Contact Admin requests.
   * Only meaningful / editable when role = admin.
   */
  admin_contact_email: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type Load = {
  id: string;
  load_number: string;
  /** Optional legacy start trailer; Trailer(s) prefers stop pickups. */
  starting_trailer_number: string | null;
  /** Current/active trailer = last checked stop with trailer; null when none/completed. */
  trailer_number: string | null;
  route_number: string | null;
  load_date: string;
  assigned_miles: number | null;
  assigned_driver_id: string | null;
  status: "active" | "pending" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type LoadStopType = "store" | "vendor" | "dc";

export type LoadStop = {
  id: string;
  load_id: string;
  stop_type: LoadStopType;
  stop_name: string;
  pickup_number: string | null;
  /** Trailer picked up at this stop; becomes current only when stop is checked. */
  trailer_number: string | null;
  delivery_order: number;
  /**
   * Driver marked this stop done (UI strikethrough).
   * Current load trailer = last checked stop with a non-empty trailer_number.
   */
  completed: boolean;
  arrived_at: string | null;
  created_at: string;
};

/** Audit row when a trailer becomes current (not when merely added to a stop). */
export type LoadTrailerHistory = {
  id: string;
  load_id: string;
  trailer_number: string;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
};

export type DamageReport = {
  id: string;
  asset_type: AssetType;
  asset_number: string;
  /** Snapshot of company Driver ID at capture (may be null for edge cases). */
  driver_id: string | null;
  reported_by: string;
  load_id: string | null;
  route_number: string | null;
  latitude: number | null;
  longitude: number | null;
  captured_at: string;
  /** Cover photo (first image); full set in damage_report_photos. */
  r2_key: string;
  r2_url: string | null;
  /** Driver description of damage at upload (not a Feed reply). */
  report_comment: string | null;
  /**
   * Detail page view counter (each open of /feed/[id]).
   * Distinct from damage_notices ("Notice").
   */
  view_count: number;
  created_at: string;
};

/** Child photos for a damage report (cover also mirrored on DamageReport.r2_*). */
export type DamageReportPhoto = {
  id: string;
  damage_report_id: string;
  r2_key: string;
  r2_url: string | null;
  sort_order: number;
  created_at: string;
};

/** Product language: Notice / Noticed (legacy "viewed"). Table: damage_notices. */
export type DamageNotice = {
  id: string;
  damage_report_id: string;
  noticed_by: string;
  noticed_at: string;
};

/** Feed reply on a damage report (distinct from DamageReport.report_comment). */
export type DamageReportComment = {
  id: string;
  damage_report_id: string;
  author_id: string;
  /** Null = top-level reply; set to nest under another comment on the same report. */
  parent_id: string | null;
  body: string;
  created_at: string;
};

/** One-way beep on a Feed reply (like Notice — no undo). Table: damage_report_comment_beeps. */
export type DamageReportCommentBeep = {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
};

export type SafetyInboxStatus = "pending" | "reviewed" | "dismissed";

export type SafetyInboxItem = {
  id: string;
  damage_report_id: string;
  sent_by: string;
  sent_at: string;
  status: SafetyInboxStatus;
  note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type NotificationType =
  | "report_noticed"
  | "report_comment"
  | "inbox_status"
  | "inbox_referral"
  | "load_assigned";

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  damage_report_id: string | null;
  safety_inbox_item_id: string | null;
  load_id: string | null;
  actor_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type DamageReportWithNoticeCount = DamageReport & {
  notice_count: number;
};

/** Result of `safety_home_stats()` RPC (fleet aggregates for safety/admin). */
export type SafetyHomeStats = {
  total_reports: number;
  pending_review: number;
  reports_24h: number;
  reports_30d: number;
};
