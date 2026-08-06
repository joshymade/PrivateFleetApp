import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FORCE_CHANGE_PASSWORD_PATH,
  PROFILE_SETUP_PATH,
} from "@/lib/auth/profile-complete";
import { SPLASH_PATH } from "@/lib/splash";

export type PostAuthLanding = {
  /** Path for `router.replace` / `redirect` (may include `?setup=1`). */
  href: string;
  pathname: string;
  search?: Record<string, string>;
};

/**
 * App entry (`/`) shows the splash first when not hidden forever.
 * After splash Enter (or when splash is skipped), post-auth landing below applies.
 */
export { SPLASH_PATH };

/** Resolve post-login / post-splash destination (not the splash itself). */
export function resolvePostAuthLanding(opts: {
  mustChangePassword?: boolean;
  needsSetup: boolean;
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
  return { href: "/home", pathname: "/home" };
}

/**
 * Default landing after login or after splash when authenticated + not hidden.
 * Incomplete profile → setup gate; must change password → force change; else `/home`.
 * Cold open still hits `/` (splash) first via PWA `start_url` / root route.
 */
export async function getPostAuthLandingPath(
  _supabase: SupabaseClient,
  opts: {
    userId: string;
    needsSetup: boolean;
    mustChangePassword?: boolean;
  },
): Promise<PostAuthLanding> {
  void opts.userId;
  return resolvePostAuthLanding({
    mustChangePassword: opts.mustChangePassword,
    needsSetup: opts.needsSetup,
  });
}
