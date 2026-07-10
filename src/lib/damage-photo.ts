/**
 * Resolve a browser-display URL for a damage photo in R2.
 *
 * Prefers the stored `r2_url` (set at upload from `R2_PUBLIC_URL` + key).
 * Falls back to rebuilding from server env `R2_PUBLIC_URL` + `r2_key`.
 *
 * Requires a public/CDN base (r2.dev or custom domain). A private-only bucket
 * without public access will yield null / broken <img> until signed GET exists.
 * Safe on Server Components; do not rely on this in the browser without
 * `NEXT_PUBLIC_R2_PUBLIC_URL` (not used in MVP — Feed resolves on the server).
 */
export function damagePhotoUrl(r2Url: string | null, r2Key: string): string | null {
  if (r2Url) return r2Url;
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!base || !r2Key) return null;
  return `${base}/${r2Key.replace(/^\/+/, "")}`;
}
