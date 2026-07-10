import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AssetType } from "@/types/database";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
};

/**
 * Cloudflare R2 (S3-compatible) config from env.
 * Never expose secret keys to the browser.
 */
export function getR2Config(): R2Config {
  return {
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucketName: process.env.R2_BUCKET_NAME ?? "",
    publicUrl: process.env.R2_PUBLIC_URL ?? "",
  };
}

export function isR2Configured(config: R2Config = getR2Config()): boolean {
  return Boolean(
    config.accountId &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.bucketName,
  );
}

export function getR2Client(config: R2Config = getR2Config()): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // AWS SDK v3 defaults to CRC32 checksums that R2 does not implement for
    // simple PutObject. Keep checksums off unless a command requires them so
    // presigned browser PUTs are not signed with x-amz-checksum-* headers.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/**
 * Join public CDN/base URL with object key (no trailing slash on base).
 * Returns null when `R2_PUBLIC_URL` is unset — DB still stores `r2_key`;
 * Feed display needs a public base or a future signed-GET path.
 */
export function buildR2PublicUrl(
  r2Key: string,
  publicUrl: string = getR2Config().publicUrl,
): string | null {
  const base = publicUrl.trim().replace(/\/+$/, "");
  if (!base) return null;
  const key = r2Key.replace(/^\/+/, "");
  return `${base}/${key}`;
}

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function normalizeContentType(contentType: string): string | null {
  const normalized = contentType.trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(normalized)) return null;
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized;
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
    case "image/heif":
      return "heic";
    default:
      return "jpg";
  }
}

/**
 * Stable unique object key for a damage photo.
 * Pattern: `damage/{assetType}/{assetNumber}/{uuid}.{ext}`
 * Uniqueness: UUID segment + unique `r2_key` on `damage_reports` / `damage_report_photos`.
 */
export function buildDamageObjectKey(params: {
  assetType: AssetType;
  assetNumber: string;
  contentType: string;
  reportId?: string;
}): string {
  const safeAsset = params.assetNumber
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 64);
  const id = params.reportId ?? crypto.randomUUID();
  const ext = extensionForContentType(params.contentType);
  return `damage/${params.assetType}/${safeAsset || "unknown"}/${id}.${ext}`;
}

export async function createPresignedPutUrl(params: {
  r2Key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const config = getR2Config();
  if (!isR2Configured(config)) {
    throw new Error("R2 is not configured");
  }

  const client = getR2Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: params.r2Key,
    ContentType: params.contentType,
  });

  // Do not sign checksum headers — the browser PUT only sends Content-Type.
  // Signing extra headers causes SignatureDoesNotMatch / opaque CORS failures.
  return getSignedUrl(client, command, {
    expiresIn: params.expiresInSeconds ?? 60 * 5,
    unsignableHeaders: new Set([
      "x-amz-checksum-crc32",
      "x-amz-checksum-crc32c",
      "x-amz-checksum-sha1",
      "x-amz-checksum-sha256",
      "x-amz-sdk-checksum-algorithm",
      "x-amz-checksum-mode",
    ]),
  });
}

/** Damage object keys only — blocks arbitrary bucket reads via proxy routes. */
export function isDamageObjectKey(r2Key: string): boolean {
  const key = r2Key.trim();
  if (!key || key.includes("..") || key.startsWith("/")) return false;
  return /^damage\/(trailer|tractor)\/[^/]+\/[^/]+\.[a-z0-9]+$/i.test(key);
}

export type R2ObjectBytes = {
  body: Uint8Array;
  contentType: string;
};

/**
 * Server-side GET of an R2 object (no browser CORS). Used by export proxy.
 */
export async function getR2ObjectBytes(r2Key: string): Promise<R2ObjectBytes> {
  const config = getR2Config();
  if (!isR2Configured(config)) {
    throw new Error("R2 is not configured");
  }

  const client = getR2Client(config);
  const result = await client.send(
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: r2Key,
    }),
  );

  if (!result.Body) {
    throw new Error("Empty R2 object body");
  }

  const body = new Uint8Array(await result.Body.transformToByteArray());
  const contentType =
    result.ContentType?.trim() ||
    (r2Key.toLowerCase().endsWith(".png")
      ? "image/png"
      : r2Key.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/jpeg");

  return { body, contentType };
}
