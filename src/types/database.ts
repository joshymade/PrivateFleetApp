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
   * Legacy: previously used for outbound Contact Admin email.
   * Messaging is internal now; column kept for existing rows.
   */
  admin_contact_email: string | null;
  /**
   * Start of work week: 0=Sun … 6=Sat. Default 5 (Friday).
   */
  week_start_day: number;
  /** Weekday numbers (0–6) the driver is normally off. Loads still allowed. */
  off_days: number[];
  /**
   * Seed start of pay period (YYYY-MM-DD, Saturday inclusive).
   * With next_pay_date (Friday end), always biweekly (14 days); periods
   * auto-advance ±n×14. Null until set.
   */
  pay_period_start: string | null;
  /**
   * Seed end of pay period (YYYY-MM-DD, Friday). Later/prior periods =
   * start/end ± n×14. Deposit/pay icon is Thursday after that Friday
   * (period end + 6, derived in app). Null until the driver sets the range
   * on Account.
   */
  next_pay_date: string | null;
  /**
   * Driver's current tractor/truck number; stamped onto new loads until changed.
   */
  current_truck_number: string | null;
  /**
   * Fleet region 1–6. Drivers set once then lock; Safety assigned by Admin.
   * Admin may leave null.
   */
  region: number | null;
  /**
   * When true, non-admins cannot change region (set after driver's first choice).
   */
  region_locked: boolean;
  role: UserRole;
  /**
   * When set, the account is locked out (middleware + login reject).
   * Cleared to re-enable.
   */
  disabled_at: string | null;
  /**
   * When true, middleware gates the user to /account/change-password
   * until they set a new password (admin-created accounts).
   */
  must_change_password: boolean;
  /**
   * Dedicated system Anonymous Driver profile used when a driver untags a report.
   */
  is_system_anonymous: boolean;
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
  /** Snapshot of driver's current truck number at create time. */
  truck_number: string | null;
  load_date: string;
  /** Company-assigned / paid miles for the load. */
  paid_miles: number | null;
  /** Odometer at load start. */
  starting_mileage: number | null;
  /** Odometer at load complete. */
  ending_mileage: number | null;
  /** Dollar amount the load paid (set on/after complete; optional). */
  pay_amount: number | null;
  assigned_driver_id: string | null;
  status: "active" | "pending" | "completed" | "cancelled" | "archived";
  /** When status became completed (pay edit lock window). */
  completed_at: string | null;
  /** When archived (closed out; excluded from stats). */
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Manual biweekly Average Daily Pay entry. */
export type AdpEntry = {
  id: string;
  driver_id: string;
  period_start: string;
  period_end: string;
  adp_amount: number;
  created_at: string;
};

/** Driver-entered earned pay for a past day with no loads. */
export type DailyPayEntry = {
  id: string;
  driver_id: string;
  work_date: string;
  amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** Driver-entered start/end punch for a calendar work day (wall-clock times). */
export type ShiftPunch = {
  id: string;
  driver_id: string;
  work_date: string;
  /** Postgres `time` as `HH:MM:SS` or `HH:MM`. */
  start_time: string | null;
  /** Postgres `time` as `HH:MM:SS` or `HH:MM`. End < start ⇒ overnight. */
  end_time: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactRequestCategory =
  | "identity"
  | "app_issue"
  | "feature"
  | "other";

/** Who opened the contact thread. */
export type ContactRequestSource = "user" | "admin";

export type ContactRequest = {
  id: string;
  /** Profile id of the non-admin participant (column name is historical). */
  driver_id: string;
  category: ContactRequestCategory;
  message: string;
  /** user = opened by the participant; admin = Admin seeded the thread. */
  source: ContactRequestSource;
  created_at: string;
};

/** Admin reply on a contact thread; users see these on Contact › Inbox. */
export type ContactReply = {
  id: string;
  contact_request_id: string;
  admin_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type LoadStopType = "store" | "vendor" | "dc";

export type LoadStop = {
  id: string;
  load_id: string;
  stop_type: LoadStopType;
  stop_name: string;
  pickup_number: string | null;
  /** Optional seal / sealed record for this stop. */
  seal_record: string | null;
  /** Optional pallet count (store stops only). */
  pallet_count: number | null;
  /** Optional position/movement count (store stops only). */
  position_count: number | null;
  /** Trailer picked up at this stop; becomes current only when stop is checked. */
  trailer_number: string | null;
  delivery_order: number;
  /**
   * Driver marked this stop Departed (UI strikethrough).
   * Once true, must not be unchecked.
   * Current load trailer = last departed stop with a non-empty trailer_number.
   */
  completed: boolean;
  /** When the stop was marked Departed; set once, never cleared. */
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

/** Fixed UUID of the system Anonymous Driver profile (migration 033). */
export const ANONYMOUS_DRIVER_PROFILE_ID =
  "a0000000-0000-4000-8000-0000000000a1" as const;

export type DamageReport = {
  id: string;
  asset_type: AssetType;
  asset_number: string;
  /** Snapshot of company Driver ID at capture (may be null for edge cases). */
  driver_id: string | null;
  reported_by: string;
  /**
   * Reporting driver at create time. Preserved after untag for deletion-request auth.
   */
  original_reported_by: string | null;
  /**
   * Snapshot of the reporting driver's profiles.region at insert (Safety scope).
   */
  reporter_region: number | null;
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
   * Damage area tags (stable keys from TRACTOR_/TRAILER_DAMAGE_LOCATION_OPTIONS).
   * Aggregated from per-photo locations on create.
   */
  damage_locations: string[];
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
  /**
   * Stable damage location key for this photo (tractor or trailer options).
   * Required for new photos; null on legacy rows.
   */
  damage_location: string | null;
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
  | "load_assigned"
  | "deletion_request"
  | "deletion_approved"
  | "deletion_dismissed"
  | "contact_message"
  | "contact_reply";

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

export type ReportDeletionRequestStatus =
  | "pending"
  | "approved"
  | "dismissed";

export type ReportDeletionRequest = {
  id: string;
  damage_report_id: string;
  requested_by: string;
  message: string | null;
  status: ReportDeletionRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type DamageReportWithNoticeCount = DamageReport & {
  notice_count: number;
};

/** Result of `safety_home_stats()` RPC (region + fleet aggregates). */
export type SafetyHomeStats = {
  /** Caller's assigned region; null if unset. */
  region: number | null;
  region_total: number;
  region_pending: number;
  region_reports_24h: number;
  region_reports_30d: number;
  fleet_total: number;
  fleet_pending: number;
  fleet_reports_24h: number;
  fleet_reports_30d: number;
  /** Legacy aliases (region for safety; fleet for admin). */
  total_reports: number;
  pending_review: number;
  reports_24h: number;
  reports_30d: number;
};

/** Shared site setting row (`app_settings`). */
export type AppSetting = {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
};

/** Max length for one-sentence site alert bar copy. */
export const SITE_ALERT_MESSAGE_MAX = 140;

/** Admin-scheduled notice shown in the app shell when today is in range. */
export type SiteAlert = {
  id: string;
  message: string;
  /** Inclusive calendar start (`YYYY-MM-DD`). */
  starts_on: string;
  /** Inclusive calendar end (`YYYY-MM-DD`). */
  ends_on: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
