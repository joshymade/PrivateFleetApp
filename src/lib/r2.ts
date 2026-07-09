/**
 * Cloudflare R2 (S3-compatible) client stub.
 * Use @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner in the presign route.
 */
export function getR2Config() {
  return {
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucketName: process.env.R2_BUCKET_NAME ?? "",
    publicUrl: process.env.R2_PUBLIC_URL ?? "",
  };
}
