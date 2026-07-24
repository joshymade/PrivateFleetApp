import { redirect } from "next/navigation";
import { AdminDeletionRequestsList } from "@/components/admin/admin-deletion-requests-list";
import { pageTitleClassName } from "@/components/ui/page-title";
import { canAccessAdminUsers, getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Deletion requests",
};

export default async function AdminDeletionRequestsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!canAccessAdminUsers(session.role)) redirect("/account");

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("report_deletion_requests")
    .select("id, damage_report_id, message, created_at, requested_by")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const requests = rows ?? [];
  const reportIds = [
    ...new Set(requests.map((r) => r.damage_report_id as string)),
  ];
  const requesterIds = [
    ...new Set(requests.map((r) => r.requested_by as string)),
  ];

  const [{ data: reports }, { data: requesters }] = await Promise.all([
    reportIds.length > 0
      ? supabase
          .from("damage_reports")
          .select("id, asset_type, asset_number")
          .in("id", reportIds)
      : Promise.resolve({ data: [] as { id: string; asset_type: string; asset_number: string }[] }),
    requesterIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, driver_id")
          .in("id", requesterIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            full_name: string | null;
            driver_id: string | null;
          }[],
        }),
  ]);

  const reportById = new Map(
    (reports ?? []).map((r) => [r.id as string, r]),
  );
  const profileById = new Map(
    (requesters ?? []).map((p) => [p.id as string, p]),
  );

  const items = requests.map((row) => {
    const report = reportById.get(row.damage_report_id as string);
    const profile = profileById.get(row.requested_by as string);
    return {
      id: row.id as string,
      damage_report_id: row.damage_report_id as string,
      message: (row.message as string | null) ?? null,
      created_at: row.created_at as string,
      asset_type: (report?.asset_type as string | null | undefined) ?? null,
      asset_number: (report?.asset_number as string | null | undefined) ?? null,
      requester_name: (profile?.full_name as string | null | undefined) ?? null,
      requester_driver_id:
        (profile?.driver_id as string | null | undefined) ?? null,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6 pt-3">
      <div>
        <h1 className={pageTitleClassName}>Deletion requests</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Drivers who untagged themselves can ask Admin to delete a report.
          Approve deletes the report; Dismiss keeps it on the Feed.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error.message}
        </p>
      ) : (
        <AdminDeletionRequestsList items={items} />
      )}
    </main>
  );
}
