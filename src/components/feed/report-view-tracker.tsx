"use client";

import { useEffect } from "react";
import { recordReportView } from "@/app/(app)/feed/actions";

/** Dedupes Strict Mode double-mount; still counts real revisits after a short window. */
const recentViews = new Map<string, number>();
const DEDUPE_MS = 2500;

/**
 * Fires once per client mount of the report detail page.
 * Avoids counting Next.js Link prefetches of the RSC payload.
 */
export function ReportViewTracker({ reportId }: { reportId: string }) {
  useEffect(() => {
    const now = Date.now();
    const last = recentViews.get(reportId) ?? 0;
    if (now - last < DEDUPE_MS) return;
    recentViews.set(reportId, now);
    void recordReportView(reportId);
  }, [reportId]);

  return null;
}
