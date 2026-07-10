"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { feedHref } from "@/lib/feed/href";

export type FeedWeekCardItem = {
  key: string;
  week: number;
  year: number;
  count: number;
  isCurrent: boolean;
};

export function FeedWeekCards({
  weeks,
  selectedWeek,
  query,
  currentYear,
}: {
  weeks: FeedWeekCardItem[];
  selectedWeek: string | null;
  query: string;
  currentYear: number;
}) {
  const scrollTargetRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    scrollTargetRef.current?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
      behavior: "instant",
    });
  }, [selectedWeek, weeks]);

  if (weeks.length === 0) return null;

  const scrollTargetKey =
    selectedWeek ?? weeks.find((w) => w.isCurrent)?.key ?? null;

  return (
    <section aria-label="Damage reports by week" className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">By week</h2>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x snap-mandatory [scrollbar-width:thin]">
        {weeks.map((w) => {
          const isSelected = selectedWeek === w.key;
          const href = isSelected
            ? feedHref({ q: query || undefined })
            : feedHref({ week: w.key, q: query || undefined });
          const isScrollTarget = scrollTargetKey === w.key;

          return (
            <Link
              key={w.key}
              ref={isScrollTarget ? scrollTargetRef : undefined}
              href={href}
              scroll={false}
              aria-current={isSelected ? "true" : undefined}
              aria-label={`Week ${w.week}, ${w.count} report${w.count === 1 ? "" : "s"}${w.isCurrent ? ", current week" : ""}${isSelected ? ", selected" : ""}`}
              className={[
                "snap-start flex min-h-16 min-w-[5.5rem] shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-2 text-center transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                w.isCurrent
                  ? "border-brand bg-brand text-white shadow-sm"
                  : isSelected
                    ? "border-brand bg-brand/10 text-foreground ring-2 ring-accent/70"
                    : "border-border bg-card text-foreground hover:border-brand/40 hover:bg-brand/5",
              ].join(" ")}
            >
              <span
                className={[
                  "text-xs font-semibold tracking-wide",
                  w.isCurrent ? "text-white/90" : "text-muted-foreground",
                ].join(" ")}
              >
                Week {w.week}
              </span>
              <span
                className={[
                  "mt-0.5 text-lg font-bold tabular-nums leading-none",
                  w.isCurrent ? "text-white" : "text-foreground",
                ].join(" ")}
              >
                {w.count}
              </span>
              <span
                className={[
                  "text-xs leading-none",
                  w.isCurrent ? "text-white/70" : "text-muted-foreground",
                ].join(" ")}
              >
                reports
              </span>
              {w.year !== currentYear ? (
                <span
                  className={[
                    "mt-0.5 text-[10px]",
                    w.isCurrent ? "text-white/80" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {w.year}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
      {selectedWeek ? (
        <p className="text-xs text-muted-foreground">
          Showing Week {selectedWeek.split("-W")[1]} — tap again to clear.
        </p>
      ) : null}
    </section>
  );
}
