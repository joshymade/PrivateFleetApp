/** Splash gate at `/` — hide-forever preference + default copy. */

export const SPLASH_PATH = "/";
export const SPLASH_TEXT_KEY = "splash_text";

/** Guest / device-level localStorage key when not signed in. */
export const SPLASH_HIDDEN_STORAGE_KEY = "pf-splash-hidden";

/** Cookie for guest hide-forever (SSR can skip splash). */
export const SPLASH_HIDDEN_GUEST_COOKIE = "pf-splash-hidden";

/**
 * Cookie prefix for per-user hide-forever on this device.
 * Full name: `pf-splash-hidden-u-<userId>`.
 */
export const SPLASH_HIDDEN_USER_COOKIE_PREFIX = "pf-splash-hidden-u-";

export const DEFAULT_SPLASH_TEXT =
  "PrivateFleet helps private-fleet drivers log loads and report trailer and tractor damage — with Safety review when you need it.";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365 * 10; // ~10 years

export function splashHiddenStorageKey(userId?: string | null): string {
  return userId
    ? `${SPLASH_HIDDEN_STORAGE_KEY}:${userId}`
    : SPLASH_HIDDEN_STORAGE_KEY;
}

export function splashHiddenUserCookieName(userId: string): string {
  return `${SPLASH_HIDDEN_USER_COOKIE_PREFIX}${userId}`;
}

export function isSplashHiddenInStorage(userId?: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(splashHiddenStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE_SEC};samesite=lax`;
}

/** Persist hide-forever for this browser (and user id when signed in). */
export function setSplashHiddenForever(userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(splashHiddenStorageKey(userId), "1");
  } catch {
    // ignore quota / private mode
  }
  if (userId) {
    setCookie(splashHiddenUserCookieName(userId), "1");
  } else {
    setCookie(SPLASH_HIDDEN_GUEST_COOKIE, "1");
  }
}

export function resolveSplashText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || DEFAULT_SPLASH_TEXT;
}

/** Destination after Enter (or when splash is skipped). */
export function resolveSplashEnterHref(isLoggedIn: boolean): string {
  return isLoggedIn ? "/home" : "/login";
}
