import { NextResponse } from "next/server";

/**
 * Stub: return a Cloudflare R2 presigned PUT URL.
 * Full implementation will use lib/r2.ts + auth checks.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Not implemented",
      message: "R2 presign route stub — wire @aws-sdk/s3-request-presigner next.",
    },
    { status: 501 },
  );
}
