import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client with default localStorage session persistence
 * so drivers stay signed in across PWA launches.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
