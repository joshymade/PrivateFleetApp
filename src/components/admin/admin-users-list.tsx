"use client";

import Link from "next/link";
import { DriverId } from "@/components/ui/driver-id";
import type { AdminUserListItem } from "@/lib/admin/users";

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function formatLastActive(user: AdminUserListItem): string {
  if (!user.last_active_at) return "Never";
  try {
    const when = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(user.last_active_at));
    if (user.last_active_source === "updated_at") {
      return `${when} (profile)`;
    }
    return when;
  } catch {
    return "—";
  }
}

export function AdminUsersList({ users }: { users: AdminUserListItem[] }) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No users yet.</p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
      {users.map((user) => (
        <li key={user.id}>
          <Link
            href={`/admin/users/${user.id}`}
            className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                {user.full_name || user.email || "Unnamed user"}
              </p>
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  user.disabled_at
                    ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {user.disabled_at ? "Disabled" : user.role}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {user.email ?? "—"}
              {user.driver_id ? (
                <>
                  {" · "}
                  <DriverId>{user.driver_id}</DriverId>
                </>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              Joined {formatShortDate(user.created_at)} · Last active{" "}
              {formatLastActive(user)}
            </p>
            <p className="text-xs text-foreground/80">
              {user.report_count} report{user.report_count === 1 ? "" : "s"} ·{" "}
              {user.load_count} load{user.load_count === 1 ? "" : "s"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
