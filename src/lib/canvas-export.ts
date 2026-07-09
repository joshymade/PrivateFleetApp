/**
 * HTML5 Canvas composite export helpers (stub).
 * Will draw photo + metadata strip and return a downloadable JPG blob.
 */
export type CanvasExportMeta = {
  trailerNumber: string;
  driverId: string;
  capturedAt: string;
  latitude?: number | null;
  longitude?: number | null;
};

export async function compositeDamageJpg(
  _image: Blob | ImageBitmap,
  _meta: CanvasExportMeta,
): Promise<Blob> {
  throw new Error("canvas-export not implemented yet");
}
