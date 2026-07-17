import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/nav/back-link";
import { InboxItemCard } from "@/components/safety/inbox-item-card";
import { pageTitleClassName } from "@/components/ui/page-title";
import {
  canAccessSafetyInbox,
  getSessionProfile,
} from "@/lib/auth/profile";
import { damagePhotoUrl } from "@/lib/damage-photo";
import { createClient } from "@/lib/supabase/server";
import type {
  AssetType,
  DamageReport,
  Profile,
  SafetyInboxItem,
  SafetyInboxStatus,
} from "@/types/database";

export const metadata = {
  title: "Safety Feed",
};

type SearchParams = Promise<{ status?: string }>;

export default async function SafetyInboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSessionProfile();
  if (!session || !canAccessSafetyInbox(session.role)) {
    redirect("/account");
  }

  const params = await searchParams;
  const statusFilter =
    params.status === "reviewed" ||
    params.status === "dismissed" ||
    params.status === "all"
      ? params.status
      : "pending";

  const supabase = await createClient();

  let query = supabase
    .from("safety_inbox_items")
    .select(
      "id, damage_report_id, sent_by, sent_at, status, note, reviewed_at, reviewed_by",
    )
    .order("sent_at", { ascending: false })
    .limit(100);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: items, error } = await query;
  const rows = (items ?? []) as SafetyInboxItem[];

  const reportIds = [...new Set(rows.map((r) => r.damage_report_id))];
  const senderIds = [...new Set(rows.map((r) => r.sent_by))];

  let reportsById = new Map<string, DamageReport>();
  let sendersById = new Map<
    string,
    Pick<Profile, "full_name" | "driver_id" | "work_state">
  >();

  if (reportIds.length > 0) {
    const { data: reports } = await supabase
      .from("damage_reports")
      .select(
        "id, asset_type, asset_number, driver_id, report_comment, r2_key, r2_url, captured_at, reported_by, load_id, route_number, latitude, longitude, created_at",
      )
      .in("id", reportIds);
    reportsById = new Map(
      ((reports ?? []) as DamageReport[]).map((r) => [r.id, r]),
    );
  }

  if (senderIds.length > 0) {
    const { data: senders } = await supabase
      .from("profiles")
      .select("id, full_name, driver_id, work_state")
      .in("id", senderIds);
    sendersById = new Map(
      (senders ?? []).map((s) => [
        s.id as string,
        {
          full_name: (s.full_name as string | null) ?? null,
          driver_id: (s.driver_id as string | null) ?? null,
          work_state: (s.work_state as string | null) ?? null,
        },
      ]),
    );
  }

  const { count: pendingCount } = await supabase
    .from("safety_inbox_items")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const filters: { key: string; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "reviewed", label: "Reviewed" },
    { key: "dismissed", label: "Dismissed" },
    { key: "all", label: "All" },
  ];

  const isSafetyViewer = session.role === "safety";

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-8 pt-4">
      {!isSafetyViewer ? (
        <BackLink href="/account" aria-label="Back to Account">
          Account
        </BackLink>
      ) : null}
      <header className={isSafetyViewer ? undefined : "mt-2"}>
        <h1 className={pageTitleClassName}>
          {isSafetyViewer ? "Safety Feed" : "Safety inbox"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reports sent to Safety
          {typeof pendingCount === "number" ? ` · ${pendingCount} pending` : ""}
          .
        </p>
      </header>

      <div className="mt-4 flex gap-1 overflow-x-auto">
        {filters.map((f) => {
          const active = statusFilter === f.key;
          const href =
            f.key === "pending"
              ? "/safety/inbox"
              : `/safety/inbox?status=${f.key}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${
                active
                  ? "bg-primary text-primary-foreground ring-2 ring-accent/70"
                  : "bg-muted text-foreground"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600">{error.message}</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {statusFilter === "pending"
            ? "No pending reports."
            : "No items in this filter."}
        </p>
      ) : (
        <ul className="mt-2">
          {rows.map((row) => {
            const report = reportsById.get(row.damage_report_id);
            const sender = sendersById.get(row.sent_by);
            if (!report) return null;
            return (
              <li key={row.id}>
                <InboxItemCard
                  item={{
                    id: row.id,
                    status: row.status as SafetyInboxStatus,
                    sent_at: row.sent_at,
                    note: row.note,
                    sender_name: sender?.full_name ?? null,
                    sender_driver_id: sender?.driver_id ?? null,
                    sender_work_state: sender?.work_state ?? null,
                    asset_type: report.asset_type as AssetType,
                    asset_number: report.asset_number,
                    driver_id: report.driver_id,
                    photo_url: damagePhotoUrl(report.r2_url, report.r2_key),
                    report_comment: report.report_comment,
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
