"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { contactAdminAboutIdentity } from "@/app/(app)/profile/actions";
import { DriverId } from "@/components/ui/driver-id";

type Props = {
  open: boolean;
  onClose: () => void;
  defaultEmail: string;
  driverId: string | null;
};

export function ContactAdminModal({
  open,
  onClose,
  defaultEmail,
  driverId,
}: Props) {
  const titleId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(defaultEmail);
    setMessage("");
    setError(null);
    setSent(false);
    const t = window.setTimeout(() => emailRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, defaultEmail]);

  useEffect(() => {
    if (!open) return;

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
  }, [open, onClose]);

  if (!open) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);

    startTransition(async () => {
      const result = await contactAdminAboutIdentity({ email, message });
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
          automatically.
        </p>

        {sent ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-brand" role="status">
              Request sent. An admin will follow up at the email you provided.
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
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Your email</span>
              <input
                ref={emailRef}
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>

            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Driver ID</span>
              <div className="min-h-11 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-foreground">
                {driverId ? <DriverId>{driverId}</DriverId> : "—"}
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Message</span>
              <textarea
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
