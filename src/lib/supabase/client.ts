import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

/**
 * Browser Supabase client with default localStorage session persistence
 * so drivers stay signed in across PWA launches.
 */
export function createClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
