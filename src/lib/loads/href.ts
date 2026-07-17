import { yearMonthString } from "./date";

/** Shared `/loads` searchParam builders. */

export function loadsHref(opts: {
  year: number;
  month: number;
  /** Expand current-month list beyond the recent preview. */
  view?: "full" | null;
}): string {
  const params = new URLSearchParams();
  params.set("month", yearMonthString(opts.year, opts.month));
  if (opts.view === "full") params.set("view", "full");
  return `/loads?${params.toString()}`;
}
