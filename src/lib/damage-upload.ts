import type { AssetType } from "@/types/database";

export type PresignResponse = {
  uploadUrl: string;
  r2Key: string;
  r2Url: string | null;
  contentType: string;
  expiresIn: number;
};

export type PresignError = {
  error: string;
  message?: string;
};

function isNetworkFetchError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    /failed to fetch|networkerror|load failed|fetch failed/i.test(err.message)
  );
}

async function readErrorBody(res: Response): Promise<string | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      return json.message ?? json.error ?? text.slice(0, 200);
    } catch {
      return text.slice(0, 200);
    }
  } catch {
    return null;
  }
}

/**
 * Request a presigned PUT URL, then upload the file to R2.
 */
export async function uploadDamagePhoto(params: {
  file: File;
  assetType: AssetType;
  assetNumber: string;
}): Promise<{ r2Key: string; r2Url: string | null }> {
  const contentType = params.file.type || "image/jpeg";

  let presignRes: Response;
  try {
    presignRes = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType,
        assetType: params.assetType,
        assetNumber: params.assetNumber,
      }),
    });
  } catch (err) {
    if (isNetworkFetchError(err)) {
      throw new Error(
        "Could not reach the upload API. Check that the app is running and you are online.",
      );
    }
    throw err;
  }

  let presignJson: PresignResponse & PresignError;
  try {
    presignJson = (await presignRes.json()) as PresignResponse & PresignError;
  } catch {
    throw new Error(
      presignRes.ok
        ? "Upload API returned an invalid response."
        : `Upload API error (${presignRes.status}).`,
    );
  }

  if (!presignRes.ok) {
    if (presignRes.status === 401) {
      throw new Error("Sign in again, then retry the upload.");
    }
    if (presignRes.status === 503) {
      throw new Error(
        presignJson.message ??
          "R2 storage is not configured on the server. Set R2_* env vars and restart.",
      );
    }
    throw new Error(
      presignJson.message ??
        presignJson.error ??
        `Could not get upload URL (${presignRes.status})`,
    );
  }

  if (!presignJson.uploadUrl || !presignJson.r2Key) {
    throw new Error("Upload API did not return a valid upload URL.");
  }

  const putContentType = presignJson.contentType || contentType;

  let putRes: Response;
  try {
    putRes = await fetch(presignJson.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": putContentType,
      },
      body: params.file,
    });
  } catch (err) {
    if (isNetworkFetchError(err)) {
      throw new Error(
        "Photo upload blocked (network/CORS). In Cloudflare R2 → bucket Settings → CORS, allow PUT from http://localhost:3000 with AllowedHeaders including Content-Type. See docs/r2-setup.md.",
      );
    }
    throw err;
  }

  if (!putRes.ok) {
    const detail = await readErrorBody(putRes);
    if (putRes.status === 403) {
      throw new Error(
        detail
          ? `Photo upload forbidden (403): ${detail}`
          : "Photo upload forbidden (403). Check R2 API token permissions and that Content-Type matches the signed URL.",
      );
    }
    throw new Error(
      detail
        ? `Photo upload failed (${putRes.status}): ${detail}`
        : `Photo upload failed (${putRes.status})`,
    );
  }

  return {
    r2Key: presignJson.r2Key,
    r2Url: presignJson.r2Url,
  };
}
