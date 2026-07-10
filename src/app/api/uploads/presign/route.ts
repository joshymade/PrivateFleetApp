import { NextResponse } from "next/server";
import {
  driverNeedsProfileSetup,
  PROFILE_INCOMPLETE_MESSAGE,
} from "@/lib/auth/profile-complete";
import {
  buildDamageObjectKey,
  buildR2PublicUrl,
  createPresignedPutUrl,
  getR2Config,
  isR2Configured,
  normalizeContentType,
} from "@/lib/r2";
import { createClient } from "@/lib/supabase/server";
import type { AssetType, UserRole } from "@/types/database";

type PresignBody = {
  contentType?: string;
  assetType?: string;
  assetNumber?: string;
};

function isAssetType(value: string): value is AssetType {
  return value === "tractor" || value === "trailer";
}

/**
 * Auth-required: returns a Cloudflare R2 presigned PUT URL for a damage photo.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, work_state")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as UserRole | undefined) ?? "driver";
  if (driverNeedsProfileSetup(role, profile)) {
    return NextResponse.json(
      {
        error: "Profile incomplete",
        message: PROFILE_INCOMPLETE_MESSAGE,
      },
      { status: 403 },
    );
  }

  const config = getR2Config();
  if (!isR2Configured(config)) {
    return NextResponse.json(
      {
        error: "R2 not configured",
        message: "Set R2_* env vars on the server before uploading.",
      },
      { status: 503 },
    );
  }

  let body: PresignBody;
  try {
    body = (await request.json()) as PresignBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contentType = normalizeContentType(body.contentType ?? "");
  if (!contentType) {
    return NextResponse.json(
      {
        error: "Unsupported content type",
        message: "Use JPEG, PNG, WebP, or HEIC.",
      },
      { status: 400 },
    );
  }

  const assetTypeRaw = (body.assetType ?? "").trim();
  if (!isAssetType(assetTypeRaw)) {
    return NextResponse.json(
      { error: "assetType must be tractor or trailer" },
      { status: 400 },
    );
  }

  const assetNumber = (body.assetNumber ?? "").trim();
  if (!assetNumber) {
    return NextResponse.json(
      { error: "assetNumber is required" },
      { status: 400 },
    );
  }

  const r2Key = buildDamageObjectKey({
    assetType: assetTypeRaw,
    assetNumber,
    contentType,
  });

  try {
    const uploadUrl = await createPresignedPutUrl({
      r2Key,
      contentType,
    });
    const r2Url = buildR2PublicUrl(r2Key, config.publicUrl);

    return NextResponse.json({
      uploadUrl,
      r2Key,
      r2Url,
      contentType,
      expiresIn: 300,
    });
  } catch (err) {
    console.error("presign failed", err);
    const detail =
      err instanceof Error ? err.message : "Unknown presign error";
    return NextResponse.json(
      {
        error: "Failed to create upload URL",
        message: `R2 signing failed: ${detail}`,
      },
      { status: 500 },
    );
  }
}
