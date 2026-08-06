"use client";

import { useState } from "react";
import { ContactForm } from "@/components/account/contact-form";
import { ContactInbox } from "@/components/account/contact-inbox";
import type { ContactReply, ContactRequest } from "@/types/database";

type InboxItem = ContactReply & {
  request: Pick<ContactRequest, "category" | "message" | "created_at"> | null;
};

type Tab = "compose" | "inbox";

export function ContactTabs({
  replies,
  unreadCount,
}: {
  replies: InboxItem[];
  unreadCount: number;
}) {
  const [tab, setTab] = useState<Tab>("compose");

  return (
    <div className="space-y-4">
      <div
        className="flex rounded-xl border border-border bg-muted/40 p-1"
        role="tablist"
        aria-label="Contact sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "compose"}
          onClick={() => setTab("compose")}
          className={`min-h-10 flex-1 rounded-lg text-sm font-medium transition-colors ${
            tab === "compose"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Send message
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "inbox"}
          onClick={() => setTab("inbox")}
          className={`min-h-10 flex-1 rounded-lg text-sm font-medium transition-colors ${
            tab === "inbox"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Inbox
          {unreadCount > 0 ? (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </div>

      {tab === "compose" ? (
        <ContactForm />
      ) : (
        <ContactInbox replies={replies} />
      )}
    </div>
  );
}
