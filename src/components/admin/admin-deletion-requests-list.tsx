"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveReportDeletion,
  dismissReportDeletion,
} from "@/app/(app)/admin/deletion-requests/actions";
import { DriverId } from "@/components/ui/driver-id";
import { formatFeedTimestamp } from "@/lib/format-time";

export type DeletionRequestListItem = {
  id: string;
  damage_report_id: string;
  message: string | null;
  created_at: string;
  asset_type: string | null;
  asset_number: string | null;
  requester_name: string | null;
  requester_driver_id: string | null;
};

export function AdminDeletionRequestsList({
  items,
}: {
  items: DeletionRequestListItem[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    requestId: string,
    action: "approve" | "dismiss",
  ) {
    if (pending) return;
    const ok =
      action === "approve"
        ? window.confirm(
            "Approve and permanently delete this damage report? Photos, notices, replies, and inbox items for it will also be removed.",
          )
        : window.confirm(
            "Dismiss this request? The report stays on the Feed and the driver will be notified.",
          );
    if (!ok) return;

    setError(null);
    setMessage(null);
    setPendingId(requestId);
    startTransition(async () => {
      const result =
        action === "approve"
          ? await approveReportDeletion(requestId)
          : await dismissReportDeletion(requestId);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Done.");
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No pending deletion requests.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const assetLabel =
            item.asset_type === "tractor"
              ? "Tractor"
              : item.asset_type === "trailer"
                ? "Trailer"
                : "Report";
          const busy = pending && pendingId === item.id;

          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium text-foreground">
                  {assetLabel}{" "}
                  <Link
                    href={`/feed/${item.damage_report_id}`}
                    className="text-brand underline-offset-2 hover:underline"
                  >
                    {item.asset_number ?? item.damage_report_id.slice(0, 8)}
                  </Link>
                </p>
                <p className="text-muted-foreground">
                  From{" "}
                  <span className="text-foreground">
                    {item.requester_name?.trim() || "Driver"}
                  </span>
                  {item.requester_driver_id ? (
                    <>
                      {" "}
                      · Driver <DriverId>{item.requester_driver_id}</DriverId>
                    </>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFeedTimestamp(item.created_at)}
                </p>
                {item.message?.trim() ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {item.message.trim()}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No message from the driver.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(item.id, "approve")}
                  className="min-h-11 flex-1 rounded-lg border border-red-700/40 px-4 text-sm font-medium text-red-700 disabled:opacity-60 dark:border-red-400/40 dark:text-red-400"
                >
                  {busy ? "Working…" : "Approve & delete"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(item.id, "dismiss")}
                  className="min-h-11 flex-1 rounded-lg border border-border px-4 text-sm font-medium text-foreground disabled:opacity-60"
                >
                  {busy ? "Working…" : "Dismiss"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
