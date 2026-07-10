"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DriverId } from "@/components/ui/driver-id";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/types/database";

const ROLES: UserRole[] = ["driver", "safety", "admin"];

function roleChangeErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("only admins can change roles") ||
    lower.includes("42501") ||
    lower.includes("permission denied") ||
    lower.includes("row-level security")
  ) {
    return "Only admins can change roles. Sign in as an admin, or promote one in Supabase Table Editor → public.profiles (role column).";
  }
  return message;
}

export function UsersRoleManager({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function onRoleChange(userId: string, role: UserRole) {
    const current = users.find((u) => u.id === userId)?.role;
    if (current === role) return;

    setError(null);
    setPendingId(userId);

    const supabase = createClient();
    // Safety/admin must not keep a company Driver ID (DB trigger also nulls it).
    const patch: { role: UserRole; driver_id?: null } = { role };
    if (role === "safety" || role === "admin") {
      patch.driver_id = null;
    }
    const { data, error: updateError } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("id, role, driver_id")
      .maybeSingle();

    setPendingId(null);

    if (updateError) {
      setError(roleChangeErrorMessage(updateError.message));
      return;
    }

    // RLS can reject with 0 rows and no error — treat as failure.
    if (!data) {
      setError(
        "Role was not updated. Only admins can change roles — sign in as an admin, or set public.profiles.role in the Supabase Table Editor / SQL Editor.",
      );
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-border border border-border">
        {users.map((user) => (
          <li key={user.id} className="flex flex-col gap-2 px-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user.full_name || user.email || "Unnamed user"}
                {user.id === currentUserId ? (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (you)
                  </span>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email ?? "—"}
                {user.driver_id ? (
                  <>
                    {" · "}
                    <DriverId>{user.driver_id}</DriverId>
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Current role:{" "}
                <span className="font-medium capitalize text-foreground">
                  {user.role}
                </span>
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Change role</span>
              <select
                className="flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm capitalize text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                value={user.role}
                disabled={pendingId === user.id}
                aria-label={`Role for ${user.email ?? user.driver_id ?? user.id}`}
                onChange={(e) =>
                  onRoleChange(user.id, e.target.value as UserRole)
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
