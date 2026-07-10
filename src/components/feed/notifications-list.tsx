"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(app)/profile/actions";
import { formatFeedTimestamp } from "@/lib/format-time";
import type { AppNotification } from "@/types/database";

const PREVIEW_LIMIT = 5;

export function hrefForNotification(n: AppNotification): string | null {
  if (n.type === "inbox_referral" && n.safety_inbox_item_id) {
    return `/safety/inbox/${n.safety_inbox_item_id}`;
  }
  if (n.type === "inbox_status" && n.damage_report_id) {
    return `/feed/${n.damage_report_id}`;
  }
  if (n.damage_report_id) return `/feed/${n.damage_report_id}`;
  if (n.load_id) return `/loads/${n.load_id}`;
  return null;
}

function NotificationRow({
  n,
  pending,
  onOpen,
}: {
  n: AppNotification;
  pending: boolean;
  onOpen: (n: AppNotification) => void;
}) {
  const href = hrefForNotification(n);
  const unread = !n.read_at;
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-sm ${
            unread
              ? "font-semibold text-foreground"
              : "font-medium text-muted-foreground line-through"
          }`}
        >
          {n.title}
        </p>
        {unread ? (
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
            aria-label="Unread"
          />
        ) : null}
      </div>
      {n.body ? (
        <p
          className={`mt-0.5 line-clamp-2 text-sm text-muted-foreground ${
            unread ? "" : "line-through"
          }`}
        >
          {n.body}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        {formatFeedTimestamp(n.created_at)}
        {href ? <span className="text-primary"> · Open</span> : null}
      </p>
    </>
  );

  return (
    <li>
      {href ? (
        <button
          type="button"
          onClick={() => onOpen(n)}
          disabled={pending}
          className="w-full py-3 text-left disabled:opacity-60"
        >
          {content}
        </button>
      ) : (
        <div className="py-3">{content}</div>
      )}
    </li>
  );
}

function NotificationsModal({
  open,
  onClose,
  notifications,
  pending,
  onOpen,
  onMarkAll,
  unreadCount,
}: {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  pending: boolean;
  onOpen: (n: AppNotification) => void;
  onMarkAll: () => void;
  unreadCount: number;
}) {
  const titleId = useId();

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
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            All notifications
            {unreadCount > 0 ? (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {unreadCount}
              </span>
            ) : null}
          </h2>
          <div className="flex items-center gap-3">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAll}
                disabled={pending}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-60"
              >
                Mark all read
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {notifications.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  pending={pending}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationsList({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read_at);
  const unreadCount = unread.length;
  const preview = unread.slice(0, PREVIEW_LIMIT);

  function onOpen(n: AppNotification) {
    const href = hrefForNotification(n);
    startTransition(async () => {
      if (!n.read_at) {
        await markNotificationRead(n.id);
      }
      if (href) router.push(href);
      else router.refresh();
    });
  }

  function onMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Latest Notifications
          {unreadCount > 0 ? (
            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {unreadCount}
            </span>
          ) : null}
        </h2>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={onMarkAll}
            disabled={pending}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-60"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {preview.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {notifications.length === 0
            ? "No notifications yet."
            : "No unread notifications."}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {preview.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              pending={pending}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}

      {notifications.length > 0 ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-3 min-h-11 w-full rounded-lg border border-border bg-background text-sm font-medium text-foreground"
        >
          View all notifications
          {notifications.length > PREVIEW_LIMIT || unreadCount < notifications.length
            ? ` (${notifications.length})`
            : ""}
        </button>
      ) : null}

      {notifications.some((n) => n.type === "inbox_referral") ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Report alerts open the{" "}
          <Link href="/safety/inbox" className="underline">
            Safety inbox
          </Link>
          .
        </p>
      ) : null}

      <NotificationsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        notifications={notifications}
        pending={pending}
        onOpen={onOpen}
        onMarkAll={onMarkAll}
        unreadCount={unreadCount}
      />
    </section>
  );
}
