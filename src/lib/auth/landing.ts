import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FORCE_CHANGE_PASSWORD_PATH,
  PROFILE_SETUP_PATH,
} from "@/lib/auth/profile-complete";

export function activeLoadEditPath(loadId: string): string {
  return `/loads/${loadId}/edit`;
}

export type PostAuthLanding = {
  /** Path for `router.replace` / `redirect` (may include `?setup=1`). */
  href: string;
  pathname: string;
  search?: Record<string, string>;
};

/** Resolve post-login / app-open destination from known active-load id. */
export function resolvePostAuthLanding(opts: {
  mustChangePassword?: boolean;
  needsSetup: boolean;
  activeLoadId: string | null;
}): PostAuthLanding {
  if (opts.mustChangePassword) {
    return {
      href: FORCE_CHANGE_PASSWORD_PATH,
      pathname: FORCE_CHANGE_PASSWORD_PATH,
    };
  }
  if (opts.needsSetup) {
    return {
      href: PROFILE_SETUP_PATH,
      pathname: "/account",
      search: { setup: "1" },
    };
  }
  if (opts.activeLoadId) {
    const pathname = activeLoadEditPath(opts.activeLoadId);
    return { href: pathname, pathname };
  }
  return { href: "/home", pathname: "/home" };
}

export async function fetchActiveLoadId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("loads")
    .select("id")
    .eq("assigned_driver_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data.id as string;
}

/**
 * Default landing after login or opening the app while authenticated.
 * Incomplete profile → setup gate; active load → edit page; else `/home`.
 */
export async function getPostAuthLandingPath(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    needsSetup: boolean;
    mustChangePassword?: boolean;
  },
): Promise<PostAuthLanding> {
  if (opts.mustChangePassword) {
    return resolvePostAuthLanding({
      mustChangePassword: true,
      needsSetup: false,
      activeLoadId: null,
    });
  }
  if (opts.needsSetup) {
    return resolvePostAuthLanding({ needsSetup: true, activeLoadId: null });
  }
  const activeLoadId = await fetchActiveLoadId(supabase, opts.userId);
  return resolvePostAuthLanding({ needsSetup: false, activeLoadId });
}
