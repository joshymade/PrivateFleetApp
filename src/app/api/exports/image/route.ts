import { NextResponse } from "next/server";
import {
  getR2Config,
  getR2ObjectBytes,
  isDamageObjectKey,
  isR2Configured,
} from "@/lib/r2";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth-required same-origin proxy for damage photos.
 * Report Export fetches here so the browser never needs R2 CORS for GET.
 *
 * Query: `?key=<r2_key>` (damage/... object key only).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get("key")?.trim() ?? "";
  if (!isDamageObjectKey(key)) {
    return NextResponse.json(
      {
        error: "Invalid key",
        message: "Expected a damage object key (damage/{trailer|tractor}/...).",
      },
      { status: 400 },
    );
  }

  // RLS must allow the caller to see this report/photo before we stream bytes.
  const { data: report } = await supabase
    .from("damage_reports")
    .select("id")
    .eq("r2_key", key)
    .maybeSingle();

  let allowed = Boolean(report);
  if (!allowed) {
    const { data: photo } = await supabase
      .from("damage_report_photos")
      .select("id")
      .eq("r2_key", key)
      .maybeSingle();
    allowed = Boolean(photo);
  }

  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isR2Configured(getR2Config())) {
    return NextResponse.json(
      {
        error: "R2 not configured",
        message: "Set R2_* env vars on the server before exporting.",
      },
      { status: 503 },
    );
  }

  try {
    const { body, contentType } = await getR2ObjectBytes(key);
    // Copy into a Node Buffer so NextResponse BodyInit typing is happy.
    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("export image proxy failed", err);
    const detail = err instanceof Error ? err.message : "Unknown R2 error";
    return NextResponse.json(
      {
        error: "Failed to load photo from R2",
        message: detail,
      },
      { status: 502 },
    );
  }
}
