/**
 * Public Supabase env for browser + SSR clients.
 * NEXT_PUBLIC_* are inlined at `next build` — set them in the host's build env
 * (Easypanel/Nixpacks), not only at runtime.
 *
 * Placeholders keep `next build` from crashing when unset; the app will not
 * authenticate until real values are baked into the client bundle.
 */
export function getPublicSupabaseEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "https://placeholder.supabase.co";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "public-anon-key-placeholder";

  return { url, anonKey };
}
