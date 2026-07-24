import Link from "next/link";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { feedHref } from "@/lib/feed/href";

const btnClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const btnDisabledClass = `${btnClass} pointer-events-none opacity-40`;

function PageControl({
  href,
  label,
  disabled,
  children,
}: {
  href: string;
  label: string;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-label={label} aria-disabled="true" className={btnDisabledClass}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} scroll={false} aria-label={label} className={btnClass}>
      {children}
    </Link>
  );
}

export function FeedPagination({
  page,
  totalPages,
  totalCount,
  week,
  query,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  week?: string | null;
  query?: string;
  /** Override link builder (e.g. unit history pages). */
  hrefForPage?: (page: number) => string;
}) {
  if (totalCount === 0) return null;

  if (totalPages <= 1) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        {totalCount} report{totalCount === 1 ? "" : "s"}
      </p>
    );
  }

  const q = query || undefined;
  const weekParam = week || undefined;
  const pageHref =
    hrefForPage ??
    ((p: number) => feedHref({ week: weekParam, page: p, q }));
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <nav
      aria-label="Feed pagination"
      className="flex flex-col items-center gap-2 pt-1"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <PageControl
            href={pageHref(1)}
            label="First page"
            disabled={atStart}
          >
            <ChevronFirst className="size-5" aria-hidden />
          </PageControl>
          <PageControl
            href={pageHref(prev)}
            label="Previous page"
            disabled={atStart}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </PageControl>
        </div>

        <p className="text-sm font-medium tabular-nums text-foreground">
          Page {page} of {totalPages}
        </p>

        <div className="flex items-center gap-1.5">
          <PageControl
            href={pageHref(next)}
            label="Next page"
            disabled={atEnd}
          >
            <ChevronRight className="size-5" aria-hidden />
          </PageControl>
          <PageControl
            href={pageHref(totalPages)}
            label="Last page"
            disabled={atEnd}
          >
            <ChevronLast className="size-5" aria-hidden />
          </PageControl>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {totalCount} report{totalCount === 1 ? "" : "s"}
      </p>
    </nav>
  );
}
