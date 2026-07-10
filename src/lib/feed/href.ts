/** Shared `/feed` searchParam builders. */

export function feedHref(opts: {
  week?: string | null;
  page?: number;
  q?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.week) params.set("week", opts.week);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const qs = params.toString();
  return qs ? `/feed?${qs}` : "/feed";
}
