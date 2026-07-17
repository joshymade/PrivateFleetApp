import Link from "next/link";
import { loadsHref } from "@/lib/loads/href";

const ctaClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-brand/40 bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * URL-driven expand/collapse for the current-month loads list
 * (mirrors Feed’s searchParam pagination, not client state).
 */
export function LoadsListExpand({
  year,
  month,
  previewLimit,
  totalCount,
  expanded,
}: {
  year: number;
  month: number;
  previewLimit: number;
  totalCount: number;
  expanded: boolean;
}) {
  if (totalCount <= previewLimit) return null;

  if (!expanded) {
    const remaining = totalCount - previewLimit;
    return (
      <div className="flex flex-col items-center gap-2 pt-1">
        <Link
          href={loadsHref({ year, month, view: "full" })}
          scroll={false}
          className={ctaClass}
        >
          View full month
        </Link>
        <p className="text-xs text-muted-foreground">
          Showing {previewLimit} of {totalCount} · {remaining} more
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      <Link
        href={loadsHref({ year, month })}
        scroll={false}
        className={ctaClass}
      >
        Show recent only
      </Link>
      <p className="text-xs text-muted-foreground">
        {totalCount} load{totalCount === 1 ? "" : "s"} this month
      </p>
    </div>
  );
}
