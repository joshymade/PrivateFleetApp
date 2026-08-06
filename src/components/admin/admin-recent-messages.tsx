import Link from "next/link";
import type { ContactRequestCategory } from "@/types/database";

const CATEGORY_LABELS: Record<ContactRequestCategory, string> = {
  identity: "Driver info",
  app_issue: "App issue",
  feature: "Feature",
  other: "Other",
};

export type AdminRecentContactItem = {
  id: string;
  driver_id: string;
  category: ContactRequestCategory;
  message: string;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
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

/** Compact inbox of recent user→admin contact threads on the users hub. */
export function AdminRecentMessages({
  items,
}: {
  items: AdminRecentContactItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No user messages yet. Open a user to message them first.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/admin/users/${item.driver_id}`}
            className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                {item.user_name || item.user_email || "User"}
              </p>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[item.category]}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {item.message.trim() || "(empty)"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatWhen(item.created_at)} · Tap to reply
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
