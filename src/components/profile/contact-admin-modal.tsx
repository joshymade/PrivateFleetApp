"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { contactAdminAboutIdentity } from "@/app/(app)/account/actions";
import { DriverId } from "@/components/ui/driver-id";

const INBOX_HREF = "/account/contact?tab=inbox";

type Props = {
  onClose: () => void;
  driverId: string | null;
};

function InboxLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href={INBOX_HREF}
      className="font-medium text-brand underline underline-offset-2"
      onClick={onNavigate}
    >
      Contact › Inbox
    </Link>
  );
}

export function ContactAdminModal({ onClose, driverId }: Props) {
  const titleId = useId();
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => messageRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);

    startTransition(async () => {
      const result = await contactAdminAboutIdentity({ message });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-foreground">
          Contact Admin
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Request a name or work-state change. Your Driver ID is included
          automatically. Admin replies in <InboxLink onNavigate={onClose} />.
        </p>

        {sent ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-brand" role="status">
              Request sent. Check <InboxLink onNavigate={onClose} /> for Admin
              replies.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 self-start rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Driver ID</span>
              <div className="min-h-11 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-foreground">
                {driverId ? <DriverId>{driverId}</DriverId> : "—"}
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Message</span>
              <textarea
                ref={messageRef}
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
                maxLength={2000}
                placeholder="What should Admin change (name and/or state)?"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>

            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send request"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="min-h-11 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
