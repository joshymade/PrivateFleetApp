"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { compositeDamageJpg } from "@/lib/canvas-export";
import type { AssetType } from "@/types/database";

export type ExportPhotoOption = {
  r2_key: string;
  /** Preview only (public R2 URL). Export loads via same-origin proxy. */
  photo_url: string | null;
  sort_order: number;
};

export type ExportReportOption = {
  id: string;
  asset_type: AssetType;
  asset_number: string;
  /** Header-style display name (e.g. "Stanly K"). */
  reporter_display_name: string | null;
  /** USPS 2-letter work state; rendered as text on the strip. */
  reporter_work_state: string | null;
  driver_id: string | null;
  captured_at: string;
  latitude: number | null;
  longitude: number | null;
  route_number: string | null;
  report_comment: string | null;
  photos: ExportPhotoOption[];
};

const DOWNLOAD_GAP_MS = 400;

function assetLabel(type: AssetType) {
  return type === "tractor" ? "Tractor" : "Trailer";
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revoke so the browser can start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

function exportImageProxyUrl(r2Key: string) {
  return `/api/exports/image?key=${encodeURIComponent(r2Key)}`;
}

function formatExportError(err: unknown): string {
  if (
    err instanceof TypeError &&
    /failed to fetch|networkerror|load failed/i.test(err.message)
  ) {
    return "Network error loading photo for export. Retry, or check that you are signed in and R2_* env vars are set (docs/r2-setup.md).";
  }
  if (err instanceof Error) return err.message;
  return "Export failed.";
}

function safeFilenamePart(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "asset"
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function loadPhotoBlob(r2Key: string): Promise<Blob> {
  const res = await fetch(exportImageProxyUrl(r2Key));
  if (!res.ok) {
    let message = "Could not load photo for export.";
    try {
      const body = (await res.json()) as {
        error?: string;
        message?: string;
      };
      message = body.message || body.error || message;
      if (res.status === 503) {
        message =
          "R2 is not configured on the server. Set R2_* in .env.local (docs/r2-setup.md).";
      } else if (res.status === 401) {
        message = "Sign in again, then retry export.";
      } else if (res.status === 404) {
        message = "Photo not found or you do not have access.";
      }
    } catch {
      /* non-JSON body */
    }
    throw new Error(message);
  }
  return res.blob();
}

export function ExportForm({
  reports,
  initialReportId,
  autoDownload = false,
}: {
  reports: ExportReportOption[];
  initialReportId?: string | null;
  /** When true (e.g. from report detail Report Export), start downloads once on mount. */
  autoDownload?: boolean;
}) {
  const autoStartedRef = useRef(false);
  const initial =
    (initialReportId && reports.find((r) => r.id === initialReportId)?.id) ||
    reports[0]?.id ||
    "";
  const [selectedId, setSelectedId] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = reports.find((r) => r.id === selectedId) ?? null;
  const photoCount = selected?.photos.length ?? 0;
  const previewUrl = selected?.photos[0]?.photo_url ?? null;

  function runExport(report: ExportReportOption) {
    if (report.photos.length === 0) {
      setError("No photos for this report.");
      return;
    }
    setError(null);
    const photos = report.photos;
    startTransition(async () => {
      try {
        const total = photos.length;
        const assetPart = safeFilenamePart(report.asset_number);
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i]!;
          setProgress({ current: i + 1, total });
          const imageBlob = await loadPhotoBlob(photo.r2_key);
          const jpg = await compositeDamageJpg(imageBlob, {
            assetNumber: report.asset_number,
            assetTypeLabel: assetLabel(report.asset_type),
            reporterDisplayName: report.reporter_display_name,
            workStateCode: report.reporter_work_state,
            driverId: report.driver_id ?? "—",
            capturedAt: report.captured_at,
            latitude: report.latitude,
            longitude: report.longitude,
            routeNumber: report.route_number,
            reportComment: report.report_comment,
          });
          const name = `${report.asset_type}-${assetPart}-${i + 1}.jpg`;
          downloadBlob(jpg, name);
          if (i < photos.length - 1) {
            await sleep(DOWNLOAD_GAP_MS);
          }
        }
        setProgress(null);
      } catch (e) {
        setProgress(null);
        setError(formatExportError(e));
      }
    });
  }

  function onExport() {
    if (!selected) {
      setError("No photos for this report.");
      return;
    }
    runExport(selected);
  }

  useEffect(() => {
    if (!autoDownload || autoStartedRef.current) return;
    autoStartedRef.current = true;

    // Strip flag without a Next navigation so refresh won't re-fire and the
    // in-flight download queue is not interrupted by a remount.
    const url = new URL(window.location.href);
    if (url.searchParams.has("autodownload")) {
      url.searchParams.delete("autodownload");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }

    const report =
      (initialReportId && reports.find((r) => r.id === initialReportId)) ||
      reports[0] ||
      null;
    if (!report) return;
    // Defer so autodownload setState is not sync inside the effect body.
    queueMicrotask(() => {
      runExport(report);
    });
    // Intentionally once on mount for deep-link autodownload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No damage reports to export yet. Upload from Report first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Damage report</span>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setError(null);
            setProgress(null);
          }}
          disabled={pending}
          className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        >
          {reports.map((r) => (
            <option key={r.id} value={r.id}>
              {assetLabel(r.asset_type)} {r.asset_number} ·{" "}
              {formatWhen(r.captured_at)}
              {r.photos.length > 1 ? ` · ${r.photos.length} photos` : ""}
            </option>
          ))}
        </select>
      </label>

      {previewUrl ? (
        <div className="overflow-hidden rounded-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="max-h-64 w-full object-contain"
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Photo unavailable for preview.
        </p>
      )}

      {photoCount > 1 ? (
        <p className="text-xs text-muted-foreground">
          This report has {photoCount} photos. Each downloads as a JPG with a
          metadata strip.
        </p>
      ) : null}

      <button
        type="button"
        onClick={onExport}
        disabled={pending || photoCount === 0}
        className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending && progress
          ? `Downloading ${progress.current} of ${progress.total}…`
          : pending
            ? "Preparing…"
            : photoCount > 1
              ? "Download all photos"
              : "Download JPG with metadata"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        Each file adds a white strip with asset, reporter name/state, driver
        ID, time, GPS, and report comment. Multiple photos download one after
        another (not a zip).
      </p>
    </div>
  );
}
