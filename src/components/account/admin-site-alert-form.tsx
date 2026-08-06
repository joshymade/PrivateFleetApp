"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createSiteAlert,
  setSiteAlertActive,
} from "@/app/(app)/account/actions";
import { todayDateString } from "@/lib/loads/date";
import { SITE_ALERT_MESSAGE_MAX } from "@/lib/site-alerts";
import type { SiteAlert } from "@/types/database";

function formatDay(isoDate: string): string {
  try {
    const [y, m, d] = isoDate.split("-").map(Number);
    if (!y || !m || !d) return isoDate;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(y, m - 1, d));
  } catch {
    return isoDate;
  }
}

export function AdminSiteAlertForm({
  initialAlerts,
}: {
  initialAlerts: SiteAlert[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [startsOn, setStartsOn] = useState(todayDateString());
  const [endsOn, setEndsOn] = useState(todayDateString());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await createSiteAlert({
        message,
        startsOn,
        endsOn,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("");
      setSaved(true);
      router.refresh();
    });
  }

  function toggleActive(alert: SiteAlert, active: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setSiteAlertActive(alert.id, active);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onCreate} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Notice text</span>
          <input
            type="text"
            name="message"
            value={message}
            maxLength={SITE_ALERT_MESSAGE_MAX}
            onChange={(e) => {
              setMessage(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. Offices closed Monday for Memorial Day."
            disabled={pending}
            className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <span className="text-[11px] text-muted-foreground">
            {message.length}/{SITE_ALERT_MESSAGE_MAX} — one sentence shown site-wide.
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Starts</span>
            <input
              type="date"
              name="starts_on"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              disabled={pending}
              required
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Ends</span>
            <input
              type="date"
              name="ends_on"
              value={endsOn}
              min={startsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              disabled={pending}
              required
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>
        </div>

        <p className="text-xs text-muted-foreground">
          Runs on each calendar day from start through end (inclusive). Hidden
          outside that range or when deactivated.
        </p>

        <button
          type="submit"
          disabled={pending || message.trim().length === 0}
          className="min-h-11 self-start rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : "Publish notice"}
        </button>
      </form>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {saved ? <p className="text-xs text-brand">Notice published.</p> : null}

      {initialAlerts.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t border-border pt-3">
          {initialAlerts.map((alert) => (
            <li
              key={alert.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground">{alert.message}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDay(alert.starts_on)}
                  {alert.starts_on !== alert.ends_on
                    ? ` – ${formatDay(alert.ends_on)}`
                    : null}
                  {!alert.active ? " · Off" : null}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggleActive(alert, !alert.active)}
                className="min-h-10 shrink-0 rounded-lg border border-border px-3 text-xs font-medium text-foreground disabled:opacity-50"
              >
                {alert.active ? "Deactivate" : "Reactivate"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
