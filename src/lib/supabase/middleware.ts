import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  driverNeedsProfileSetup,
  type ProfileCompletenessFields,
} from "@/lib/auth/profile-complete";
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

function isProfilePath(pathname: string): boolean {
  return pathname === "/profile" || pathname.startsWith("/profile/");
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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    if (AUTH_PATHS.has(pathname)) {
      if (needsSetup) {
        return redirectWithSession(request, supabaseResponse, "/profile", {
          setup: "1",
        });
      }
      return redirectWithSession(request, supabaseResponse, "/home");
    }

    // Incomplete drivers may only use Profile until required fields are set.
    if (needsSetup && isAppPath(pathname) && !isProfilePath(pathname)) {
      return redirectWithSession(request, supabaseResponse, "/profile", {
        setup: "1",
      });
    }
  }

  return supabaseResponse;
}
