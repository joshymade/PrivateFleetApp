import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPostAuthLandingPath } from "@/lib/auth/landing";
import {
  driverNeedsProfileSetup,
  type ProfileCompletenessFields,
} from "@/lib/auth/profile-complete";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import type { UserRole } from "@/types/database";

const AUTH_PATHS = new Set(["/login", "/signup"]);

function isAppPath(pathname: string): boolean {
  if (AUTH_PATHS.has(pathname)) return false;
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/serwist/")) return false;
  if (pathname.startsWith("/~offline")) return false;
  // Public landing redirects itself; treat protected app surfaces below.
  return (
    pathname === "/home" ||
    pathname.startsWith("/home/") ||
    pathname === "/loads" ||
    pathname.startsWith("/loads/") ||
    pathname === "/feed" ||
    pathname.startsWith("/feed/") ||
    pathname === "/report" ||
    pathname.startsWith("/report/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/export" ||
    pathname.startsWith("/export/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/damage" ||
    pathname.startsWith("/damage/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/safety" ||
    pathname.startsWith("/safety/")
  );
}

function isAccountPath(pathname: string): boolean {
  return (
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/")
  );
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

function redirectWithSession(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string,
  search?: Record<string, string>,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (search) {
    for (const [key, value] of Object.entries(search)) {
      url.searchParams.set(key, value);
    }
  }
  const redirectResponse = NextResponse.redirect(url);
  copyCookies(supabaseResponse, redirectResponse);
  return redirectResponse;
}

/**
 * Refresh the auth session on each matched request.
 * Used by src/middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey } = getPublicSupabaseEnv();
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh session if expired — important for Server Components.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isAppPath(pathname)) {
    return redirectWithSession(request, supabaseResponse, "/login", {
      next: pathname,
    });
  }

  if (user) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("role, full_name, work_state")
      .eq("id", user.id)
      .maybeSingle();

    const profile = profileRow as ProfileCompletenessFields & {
      role?: UserRole | null;
    } | null;
    const role: UserRole = profile?.role ?? "driver";
    const needsSetup = driverNeedsProfileSetup(role, profile);

    // Legacy /profile → /account (preserve setup query).
    if (pathname === "/profile" || pathname.startsWith("/profile/")) {
      const rest = pathname === "/profile" ? "" : pathname.slice("/profile".length);
      const search: Record<string, string> = {};
      request.nextUrl.searchParams.forEach((value, key) => {
        search[key] = value;
      });
      return redirectWithSession(
        request,
        supabaseResponse,
        `/account${rest}`,
        Object.keys(search).length ? search : undefined,
      );
    }

    if (AUTH_PATHS.has(pathname)) {
      const landing = await getPostAuthLandingPath(supabase, {
        userId: user.id,
        needsSetup,
      });
      return redirectWithSession(
        request,
        supabaseResponse,
        landing.pathname,
        landing.search,
      );
    }

    // Incomplete drivers may only use Account until required fields are set.
    if (needsSetup && isAppPath(pathname) && !isAccountPath(pathname)) {
      return redirectWithSession(request, supabaseResponse, "/account", {
        setup: "1",
      });
    }
  }

  return supabaseResponse;
}
