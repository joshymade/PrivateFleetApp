"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(app)/account/actions";
import {
  hrefForNotification,
  NotificationsModal,
} from "@/components/feed/notifications-list";
import type { AppNotification } from "@/types/database";

type NotificationBellProps = {
  notifications: AppNotification[];
  unreadCount: number;
  hasMore: boolean;
};

export function NotificationBell({
  notifications,
  unreadCount,
  hasMore,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const hasUnread = unreadCount > 0;

  function onOpen(n: AppNotification) {
    const href = hrefForNotification(n);
    setOpen(false);
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-brand ring-1 ring-accent/60 transition-colors hover:bg-brand/10 ${
          hasUnread ? "motion-safe:animate-feed-badge-pulse bg-brand/10" : ""
        }`}
        aria-label={
          hasUnread
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
      >
        <Bell className="h-5 w-5" strokeWidth={hasUnread ? 2.25 : 1.75} aria-hidden />
        {hasUnread ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground shadow-sm ring-2 ring-background"
            aria-hidden
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      <NotificationsModal
        open={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        pending={pending}
        onOpen={onOpen}
        onMarkAll={onMarkAll}
        unreadCount={unreadCount}
        hasMore={hasMore}
      />
    </>
  );
}
