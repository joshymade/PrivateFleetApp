"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markContactRepliesRead } from "@/app/(app)/account/actions";
import type { ContactReply, ContactRequest } from "@/types/database";

type InboxItem = ContactReply & {
  request: Pick<ContactRequest, "category" | "message" | "created_at"> | null;
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

export function ContactInbox({ replies }: { replies: InboxItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unreadIds = replies.filter((r) => !r.read_at).map((r) => r.id);

  function markAllRead() {
    if (pending || unreadIds.length === 0) return;
    startTransition(async () => {
      await markContactRepliesRead(unreadIds);
      router.refresh();
    });
  }

  if (replies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No replies from Admin yet. Messages you send appear here when Admin
        responds.
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
        {replies.map((reply) => (
          <li
            key={reply.id}
            className={`rounded-2xl border px-3 py-2.5 text-sm ${
              reply.read_at
                ? "border-border bg-card"
                : "border-brand/40 bg-brand/5"
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Admin · {formatWhen(reply.created_at)}
              {!reply.read_at ? " · Unread" : null}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {reply.body}
            </p>
            {reply.request ? (
              <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                Re: {CATEGORY_LABELS[reply.request.category] ?? "Message"} —{" "}
                <span className="line-clamp-2">{reply.request.message}</span>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
