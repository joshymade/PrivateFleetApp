"use client";

import {
  Camera,
  Home,
  Newspaper,
  UserRound,
  type LucideProps,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { SemiTruckIcon } from "@/components/icons/semi-truck-icon";
import type { UserRole } from "@/types/database";

type NavIcon = ComponentType<
  Pick<LucideProps, "className" | "strokeWidth" | "aria-hidden">
>;

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  iconClassName?: string;
  match: (pathname: string) => boolean;
  badge?: number;
  disabled?: boolean;
};

function buildNavItems(
  role: UserRole,
  unreadNotifications: number,
  profileIncomplete: boolean,
  profileSetupHref: string,
): NavItem[] {
  const items: NavItem[] = [
    {
      href: profileIncomplete ? profileSetupHref : "/home",
      label: "Home",
      icon: Home,
      match: (p) => p === "/home" || p.startsWith("/home/"),
      disabled: profileIncomplete,
    },
  ];

  if (role === "driver" || role === "admin") {
    items.push({
      href: profileIncomplete ? profileSetupHref : "/loads",
      label: "Loads",
      icon: SemiTruckIcon,
      // Wider than square so the tractor + trailer silhouette stays readable.
      iconClassName: "h-5 w-7",
      match: (p) => p === "/loads" || p.startsWith("/loads/"),
      disabled: profileIncomplete && role === "driver",
    });
  }

  // Safety Feed = referred inbox only (not the full fleet damage feed).
  if (role === "safety") {
    items.push({
      href: "/safety/inbox",
      label: "Feed",
      icon: Newspaper,
      match: (p) =>
        p === "/safety/inbox" ||
        p.startsWith("/safety/inbox/") ||
        p === "/feed" ||
        p.startsWith("/feed/"),
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
    });
  } else {
    items.push({
      href: profileIncomplete ? profileSetupHref : "/feed",
      label: "Feed",
      icon: Newspaper,
      match: (p) => p === "/feed" || p.startsWith("/feed/"),
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
      disabled: profileIncomplete,
    });
  }

  if (role === "driver") {
    items.push({
      href: profileIncomplete ? profileSetupHref : "/report",
      label: "Report",
      icon: Camera,
      match: (p) => p === "/report" || p.startsWith("/report/"),
      disabled: profileIncomplete,
    });
  }

  items.push({
    href: "/account",
    label: "Account",
    icon: UserRound,
    match: (p) =>
      p === "/account" ||
      p.startsWith("/account/") ||
      p === "/profile" ||
      p.startsWith("/profile/") ||
      p.startsWith("/admin/") ||
      (role !== "safety" && p.startsWith("/safety/")),
  });

  return items;
}

export function BottomNav({
  role,
  unreadNotifications = 0,
  profileIncomplete = false,
  profileSetupHref = "/account?setup=1",
}: {
  role: UserRole;
  unreadNotifications?: number;
  profileIncomplete?: boolean;
  profileSetupHref?: string;
}) {
  const pathname = usePathname() ?? "/home";
  const items = buildNavItems(
    role,
    unreadNotifications,
    profileIncomplete,
    profileSetupHref,
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-nav-border bg-nav">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          const muted = item.disabled;
          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium ${
                  active && !muted
                    ? "text-brand"
                    : muted
                      ? "text-muted-foreground/50"
                      : "text-muted-foreground"
                }`}
                aria-current={active && !muted ? "page" : undefined}
                aria-disabled={muted || undefined}
                title={
                  muted
                    ? "Complete your profile to continue"
                    : undefined
                }
              >
                <span
                  className={`relative inline-flex ${
                    item.badge != null && !muted
                      ? "motion-safe:animate-feed-badge-pulse"
                      : ""
                  }`}
                >
                  <Icon
                    className={`${item.iconClassName ?? "h-5 w-5"} ${
                      active && !muted ? "text-accent" : ""
                    }`}
                    strokeWidth={active && !muted ? 2.25 : 1.75}
                    aria-hidden
                  />
                  {item.badge != null && !muted ? (
                    <span
                      className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground shadow-sm ring-2 ring-nav"
                      aria-label={`${item.badge} unread`}
                    >
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={
                    item.badge != null && !muted
                      ? "motion-safe:animate-feed-badge-pulse"
                      : undefined
                  }
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
