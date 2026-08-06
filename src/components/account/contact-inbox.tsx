"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markContactRepliesRead } from "@/app/(app)/account/actions";
import type {
  ContactReply,
  ContactRequest,
  ContactRequestSource,
} from "@/types/database";

type ReplyItem = ContactReply & {
  request: Pick<ContactRequest, "category" | "message" | "created_at"> | null;
};

type RequestItem = Pick<
  ContactRequest,
  "id" | "category" | "message" | "source" | "created_at"
>;

type ThreadItem =
  | {
      kind: "request";
      id: string;
      at: string;
      category: ContactRequest["category"];
      body: string;
      source: ContactRequestSource;
    }
  | {
      kind: "reply";
      id: string;
      at: string;
      body: string;
      read_at: string | null;
      request: ReplyItem["request"];
    };

const CATEGORY_LABELS: Record<string, string> = {
  identity: "Driver info",
  app_issue: "App issue",
  feature: "Feature",
  other: "Other",
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

function buildThread(
  requests: RequestItem[],
  replies: ReplyItem[],
): ThreadItem[] {
  const items: ThreadItem[] = [
    ...requests
      // Skip empty admin-seeded placeholders (body lives in replies).
      .filter((r) => !(r.source === "admin" && !r.message.trim()))
      .map((r) => ({
        kind: "request" as const,
        id: r.id,
        at: r.created_at,
        category: r.category,
        body: r.message,
        source: r.source,
      })),
    ...replies.map((r) => ({
      kind: "reply" as const,
      id: r.id,
      at: r.created_at,
      body: r.body,
      read_at: r.read_at,
      request: r.request,
    })),
  ];
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items;
}

export function ContactInbox({
  requests,
  replies,
}: {
  requests: RequestItem[];
  replies: ReplyItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unreadIds = replies.filter((r) => !r.read_at).map((r) => r.id);
  const thread = buildThread(requests, replies);

  function markAllRead() {
    if (pending || unreadIds.length === 0) return;
    startTransition(async () => {
      await markContactRepliesRead(unreadIds);
      router.refresh();
    });
  }

  if (thread.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No messages yet. Messages you send to Admin appear here, along with
        their replies.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {unreadIds.length > 0 ? (
        <button
          type="button"
          onClick={markAllRead}
          disabled={pending}
          className="text-sm font-medium text-brand underline-offset-2 hover:underline disabled:opacity-60"
        >
          {pending ? "Marking…" : `Mark ${unreadIds.length} unread as read`}
        </button>
      ) : null}

      <ul className="flex flex-col gap-2">
        {thread.map((item) => {
          if (item.kind === "request" && item.source === "user") {
            return (
              <li
                key={`req-${item.id}`}
                className="rounded-2xl border border-border bg-muted/30 px-3 py-2.5 text-sm"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  You · {CATEGORY_LABELS[item.category] ?? "Message"} ·{" "}
                  {formatWhen(item.at)} · Sent
                </p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">
                  {item.body}
                </p>
              </li>
            );
          }

          if (item.kind === "request") {
            // Admin-seeded thread opener with a body
            return (
              <li
                key={`req-${item.id}`}
                className="rounded-2xl border border-brand/40 bg-brand/5 px-3 py-2.5 text-sm"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Admin · {formatWhen(item.at)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">
                  {item.body}
                </p>
              </li>
            );
          }

          return (
            <li
              key={`reply-${item.id}`}
              className={`rounded-2xl border px-3 py-2.5 text-sm ${
                item.read_at
                  ? "border-border bg-card"
                  : "border-brand/40 bg-brand/5"
              }`}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Admin · {formatWhen(item.at)}
                {!item.read_at ? " · Unread" : null}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">
                {item.body}
              </p>
              {item.request ? (
                <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  Re: {CATEGORY_LABELS[item.request.category] ?? "Message"} —{" "}
                  <span className="line-clamp-2">{item.request.message}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
