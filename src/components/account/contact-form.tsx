"use client";

import { useState, useTransition } from "react";
import { submitContactRequest } from "@/app/(app)/account/actions";
import type { ContactRequestCategory } from "@/types/database";

const CATEGORIES: { value: ContactRequestCategory; label: string }[] = [
  { value: "identity", label: "Change driver info" },
  { value: "app_issue", label: "App issue" },
  { value: "feature", label: "Feature suggestion" },
  { value: "other", label: "Other" },
];

export function ContactForm({ defaultEmail }: { defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [category, setCategory] =
    useState<ContactRequestCategory>("app_issue");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await submitContactRequest({ email, category, message });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("");
      setDone(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Your email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Topic</span>
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as ContactRequestCategory)
          }
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Message</span>
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the change, issue, or idea…"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-base"
        />
      </label>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Message sent to Admin.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send to Admin"}
      </button>
    </form>
  );
}
