/**
 * HTML5 Canvas composite export: photo + white metadata strip → JPG blob.
 * Client-side only (uses document.createElement / Canvas APIs).
 */

export type CanvasExportMeta = {
  /** Asset number (trailer or tractor). */
  assetNumber: string;
  /** Prefer "Trailer" / "Tractor"; falls back to generic label. */
  assetTypeLabel?: string;
  /**
   * Header-style display name (e.g. "Stanly K").
   * Combined with workStateCode as "{name} out of {STATE}".
   */
  reporterDisplayName?: string | null;
  /** USPS 2-letter work state code (text on strip; no StateIcon SVG). */
  workStateCode?: string | null;
  driverId: string;
  capturedAt: string;
  latitude?: number | null;
  longitude?: number | null;
  routeNumber?: string | null;
  reportComment?: string | null;
  /** Human-readable damage location for this photo (export strip). */
  damageLocationLabel?: string | null;
  /** @deprecated use assetNumber */
  trailerNumber?: string;
};

const STRIP_MIN_HEIGHT = 200;
const STRIP_PADDING = 24;
const LINE_HEIGHT = 30;
const MAX_WIDTH = 1600;

function formatGps(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

/**
 * Draw photo, append solid white metadata strip, return JPG blob.
 */
export async function compositeDamageJpg(
  image: Blob | ImageBitmap,
  meta: CanvasExportMeta,
): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("compositeDamageJpg must run in the browser");
  }

  const bitmap =
    image instanceof Blob ? await blobToImageBitmap(image) : image;

  const scale = Math.min(1, MAX_WIDTH / Math.max(bitmap.width, 1));
  const photoW = Math.max(1, Math.round(bitmap.width * scale));
  const photoH = Math.max(1, Math.round(bitmap.height * scale));

  const assetNumber = meta.assetNumber || meta.trailerNumber || "—";
  const assetLabel = meta.assetTypeLabel ?? "Asset";
  const gps = formatGps(meta.latitude, meta.longitude);
  const displayName = meta.reporterDisplayName?.trim() || "";
  const workState = meta.workStateCode?.trim().toUpperCase() || "";
  const reporterLine = displayName
    ? workState
      ? `${displayName} out of ${workState}`
      : displayName
    : workState
      ? `out of ${workState}`
      : null;

  const lines: string[] = [`${assetLabel} ${assetNumber}`];
  if (reporterLine) lines.push(reporterLine);
  lines.push(
    `Driver ID ${meta.driverId || "—"}`,
    `Captured: ${formatWhen(meta.capturedAt)}`,
  );
  if (meta.routeNumber) lines.push(`Route: ${meta.routeNumber}`);
  if (meta.damageLocationLabel?.trim()) {
    lines.push(`Location: ${meta.damageLocationLabel.trim()}`);
  }
  if (gps) lines.push(`GPS: ${gps}`);

  // Measure comment wrap after we have a canvas context
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) throw new Error("Canvas not available");
  measureCtx.font = "22px system-ui, sans-serif";
  const textMax = photoW - STRIP_PADDING * 2;
  let commentLines: string[] = [];
  if (meta.reportComment?.trim()) {
    commentLines = wrapText(
      measureCtx,
      meta.reportComment.trim(),
      textMax,
    ).slice(0, 4);
  }

  const stripHeight = Math.max(
    STRIP_MIN_HEIGHT,
    STRIP_PADDING * 2 +
      (lines.length + commentLines.length) * LINE_HEIGHT +
      (commentLines.length > 0 ? 10 : 0),
  );

  const canvas = document.createElement("canvas");
  canvas.width = photoW;
  canvas.height = photoH + stripHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, photoW, photoH);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, photoH, photoW, stripHeight);

  ctx.fillStyle = "#18181b";
  ctx.font = "600 22px system-ui, sans-serif";
  let y = photoH + STRIP_PADDING + 22;
  for (const line of lines) {
    ctx.fillText(line, STRIP_PADDING, y);
    y += LINE_HEIGHT;
  }

  if (commentLines.length > 0) {
    y += 6;
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillStyle = "#3f3f46";
    for (const line of commentLines) {
      ctx.fillText(line, STRIP_PADDING, y);
      y += LINE_HEIGHT;
    }
  }

  if ("close" in bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Failed to encode JPG"));
        else resolve(blob);
      },
      "image/jpeg",
      0.92,
    );
  });
}
