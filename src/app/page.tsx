import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SplashScreen } from "@/components/splash/splash-screen";
import { getPostAuthLandingPath } from "@/lib/auth/landing";
import { driverNeedsProfileSetup } from "@/lib/auth/profile-complete";
import {
  resolveSplashText,
  SPLASH_HIDDEN_GUEST_COOKIE,
  SPLASH_TEXT_KEY,
  splashHiddenUserCookieName,
} from "@/lib/splash";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export const metadata = {
  title: "Welcome",
};

function cookieIsHidden(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  name: string,
): boolean {
  return cookieStore.get(name)?.value === "1";
}

export default async function RootPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const splashSkipped = user
    ? cookieIsHidden(cookieStore, splashHiddenUserCookieName(user.id))
    : cookieIsHidden(cookieStore, SPLASH_HIDDEN_GUEST_COOKIE);

  if (splashSkipped) {
    if (!user) {
      redirect("/login");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, work_state, must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    const role = (profile?.role as UserRole | undefined) ?? "driver";
    const needsSetup = driverNeedsProfileSetup(role, profile);
    const landing = await getPostAuthLandingPath(supabase, {
      userId: user.id,
      needsSetup,
      mustChangePassword: Boolean(profile?.must_change_password),
    });
    redirect(landing.href);
  }

  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SPLASH_TEXT_KEY)
    .maybeSingle();

  return (
    <SplashScreen
      splashText={resolveSplashText(setting?.value)}
      isLoggedIn={Boolean(user)}
      userId={user?.id ?? null}
    />
  );
}
