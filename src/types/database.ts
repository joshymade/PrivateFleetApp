/** Hand-typed row shapes until `supabase gen types` is wired. */

export type Profile = {
  id: string;
  driver_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Load = {
  id: string;
  load_number: string;
  trailer_number: string;
  route_number: string | null;
  load_date: string;
  assigned_miles: number | null;
  assigned_driver_id: string | null;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type LoadStop = {
  id: string;
  load_id: string;
  stop_name: string;
  pickup_number: string | null;
  delivery_order: number;
  arrived_at: string | null;
  created_at: string;
};

export type DamageReport = {
  id: string;
  trailer_number: string;
  driver_id: string;
  reported_by: string;
  load_id: string | null;
  route_number: string | null;
  latitude: number | null;
  longitude: number | null;
  captured_at: string;
  r2_key: string;
  r2_url: string | null;
  notes: string | null;
  created_at: string;
};

export type DamageNotice = {
  id: string;
  damage_report_id: string;
  noticed_by: string;
  noticed_at: string;
};
