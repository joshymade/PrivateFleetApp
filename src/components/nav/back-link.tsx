import { ChevronLeft, Truck } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type BackLinkProps = {
  href: ComponentProps<typeof Link>["href"];
  /** Visible label next to the truck icon (e.g. "Feed", "Loads"). */
  children?: ReactNode;
  className?: string;
  /** Defaults to "Back". Override when the destination needs a clearer name. */
  "aria-label"?: string;
};

/**
 * Drill-in back control: chevron + left-facing semi-truck (brand blue / white in dark).
 * Min 44×44 tap target for mobile.
 * Motion: looping left nudge on the icon pair + hover/focus slide (respects reduced motion).
 */
export function BackLink({
  href,
  children,
  className,
  "aria-label": ariaLabel = "Back",
}: BackLinkProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={[
        "group inline-flex min-h-11 min-w-11 items-center gap-2 -ml-1.5 rounded-lg px-1.5 py-1",
        "text-sm font-medium text-brand dark:text-white",
        "underline-offset-2 hover:underline",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Outer: hover/focus slide. Inner: looping nudge. Keeps scale-x flip off transform animations. */}
      <span
        className={[
          "inline-flex shrink-0",
          "transition-transform duration-200 ease-out",
          "motion-safe:group-hover:-translate-x-2.5",
          "motion-safe:group-focus-visible:-translate-x-2.5",
        ].join(" ")}
      >
        <span className="inline-flex items-center motion-safe:animate-back-truck-nudge">
          <ChevronLeft
            aria-hidden
            className="size-4 shrink-0 -mr-0.5"
            strokeWidth={2.5}
          />
          <Truck
            aria-hidden
            className="size-5 shrink-0 scale-x-[-1]"
            strokeWidth={2.25}
          />
        </span>
      </span>
      {children ? <span>{children}</span> : null}
    </Link>
  );
}
