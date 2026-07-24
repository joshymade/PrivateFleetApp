"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteUserAccount,
  replyToContactRequest,
  resetUserLoads,
  resetUserReports,
  setUserDisabled,
  updateUserRole,
} from "@/app/(app)/admin/users/actions";
import { DriverId } from "@/components/ui/driver-id";
import type { AdminUserDetail } from "@/lib/admin/users";
import type { ContactRequestCategory, UserRole } from "@/types/database";

const ROLES: UserRole[] = ["driver", "safety", "admin"];

const CATEGORY_LABELS: Record<ContactRequestCategory, string> = {
  identity: "Driver info",
  app_issue: "App issue",
  feature: "Feature",
  other: "Other",
};

type ThreadItem =
  | {
      kind: "request";
      id: string;
      at: string;
      category: ContactRequestCategory;
      body: string;
    }
  | {
      kind: "reply";
      id: string;
      at: string;
      body: string;
      requestId: string;
    };

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function buildThread(user: AdminUserDetail): ThreadItem[] {
  const items: ThreadItem[] = [
    ...user.contact_requests.map((r) => ({
      kind: "request" as const,
      id: r.id,
      at: r.created_at,
      category: r.category,
      body: r.message,
    })),
    ...user.contact_replies.map((r) => ({
      kind: "reply" as const,
      id: r.id,
      at: r.created_at,
      body: r.body,
      requestId: r.contact_request_id,
    })),
  ];
  items.sort((a, b) => a.at.localeCompare(b.at));
  return items;
}

export function AdminUserDetailPanel({
  user,
  currentUserId,
}: {
  user: AdminUserDetail;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [confirm, setConfirm] = useState<
    null | "disable" | "enable" | "reset_reports" | "reset_loads" | "delete"
  >(null);

  const isSelf = user.id === currentUserId;
  const latestRequest = user.contact_requests[user.contact_requests.length - 1];
  const thread = buildThread(user);

  function run(
    action: () => Promise<{ ok: boolean; error?: string; message?: string }>,
    clearConfirm = true,
  ) {
    if (pending) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      if (clearConfirm) setConfirm(null);
      if (result.message) setMessage(result.message);
      setReplyBody("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">
              {user.full_name || user.email || "Unnamed user"}
              {isSelf ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (you)
                </span>
              ) : null}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {user.email ?? "—"}
            </p>
            {user.driver_id ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Driver ID: <DriverId>{user.driver_id}</DriverId>
              </p>
            ) : null}
          </div>
          {user.disabled_at ? (
            <span className="shrink-0 rounded-md bg-red-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:bg-red-950/50 dark:text-red-300">
              Disabled
            </span>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground/70">Joined</dt>
            <dd>{formatWhen(user.created_at)}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground/70">Last active</dt>
            <dd>
              {user.last_active_at
                ? `${formatWhen(user.last_active_at)}${
                    user.last_active_source === "updated_at"
                      ? " (profile)"
                      : ""
                  }`
                : "Never"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground/70">Reports</dt>
            <dd>{user.report_count}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground/70">Loads</dt>
            <dd>{user.load_count}</dd>
          </div>
        </dl>

        <label className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Role</span>
          <select
            className="flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm capitalize text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
            value={user.role}
            disabled={pending}
            aria-label="Change role"
            onChange={(e) =>
              run(() => updateUserRole(user.id, e.target.value as UserRole), false)
            }
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Messages</h2>
        {thread.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This user has not sent any contact messages yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {thread.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className={`rounded-2xl px-3 py-2.5 text-sm ${
                  item.kind === "request"
                    ? "border border-border bg-muted/30"
                    : "border border-brand/30 bg-brand/5"
                }`}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.kind === "request"
                    ? `Driver · ${CATEGORY_LABELS[item.category]}`
                    : "Admin reply"}{" "}
                  · {formatWhen(item.at)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        )}

        {latestRequest ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() =>
                replyToContactRequest({
                  contactRequestId: latestRequest.id,
                  body: replyBody,
                }),
              );
            }}
          >
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Reply to driver</span>
              <textarea
                rows={3}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Your reply appears in their Contact inbox…"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-base"
                disabled={pending}
              />
            </label>
            <button
              type="submit"
              disabled={pending || replyBody.trim().length === 0}
              className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send reply"}
            </button>
          </form>
        ) : null}
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <h2 className="text-sm font-semibold text-foreground">Admin actions</h2>

        {!confirm ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={pending || isSelf}
              onClick={() =>
                setConfirm(user.disabled_at ? "enable" : "disable")
              }
              className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium text-foreground disabled:opacity-50"
            >
              {user.disabled_at ? "Re-enable account" : "Disable account"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirm("reset_reports")}
              className="min-h-11 rounded-xl border border-amber-600/40 px-4 text-sm font-medium text-amber-800 dark:text-amber-300"
            >
              Reset reports ({user.report_count})
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirm("reset_loads")}
              className="min-h-11 rounded-xl border border-amber-600/40 px-4 text-sm font-medium text-amber-800 dark:text-amber-300"
            >
              Reset loads ({user.load_count})
            </button>
            <button
              type="button"
              disabled={pending || isSelf}
              onClick={() => setConfirm("delete")}
              className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Delete account
            </button>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
            <p className="text-sm text-red-800 dark:text-red-200">
              {confirm === "disable"
                ? "Disable this account? They will be signed out and cannot use the app until re-enabled."
                : confirm === "enable"
                  ? "Re-enable this account so they can sign in again?"
                  : confirm === "reset_reports"
                    ? `Permanently delete all ${user.report_count} damage report(s) for this user (photos, notices, replies, inbox items)?`
                    : confirm === "reset_loads"
                      ? `Permanently delete all ${user.load_count} load(s) for this user (stops and trailer history)?`
                      : "Permanently delete this account and all their data? This cannot be undone."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm === "disable") {
                    run(() => setUserDisabled(user.id, true));
                  } else if (confirm === "enable") {
                    run(() => setUserDisabled(user.id, false));
                  } else if (confirm === "reset_reports") {
                    run(() => resetUserReports(user.id));
                  } else if (confirm === "reset_loads") {
                    run(() => resetUserLoads(user.id));
                  } else if (confirm === "delete") {
                    run(() => deleteUserAccount(user.id));
                  }
                }}
                className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Working…" : "Confirm"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirm(null)}
                className="min-h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      ) : null}
    </div>
  );
}
