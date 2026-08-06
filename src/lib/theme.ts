import {
  buildSolarDaytimeCheckScript,
  SOLAR_COORDS_STORAGE_KEY,
} from "@/lib/solar";

export const THEME_STORAGE_KEY = "pf-theme";
export const THEME_COOKIE_NAME = "pf-theme";
export const SUNSET_STORAGE_KEY = "pf-theme-sunset";

/** Manual appearance preference — sunset mode overrides this when enabled. */
export type ThemePreference = "light" | "dark";

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark";
}

/** Map legacy `"system"` (and anything else) to a concrete theme. */
export function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === "dark") return "dark";
  if (value === "light") return "light";
  // Legacy system / unknown → light
  return "light";
}

export function normalizeSunsetPreference(value: unknown): boolean {
  return value === "1" || value === "true" || value === true;
}

/**
 * Resolve light/dark for the DOM.
 * When `sunset` is true, `solarResolved` (from sunrise/sunset) wins;
 * otherwise the manual preference is used.
 */
export function resolveTheme(
  preference: ThemePreference,
  options?: { sunset?: boolean; solarResolved?: "light" | "dark" },
): "light" | "dark" {
  if (options?.sunset && options.solarResolved) {
    return options.solarResolved;
  }
  return preference;
}

const solarCheck = buildSolarDaytimeCheckScript(SOLAR_COORDS_STORAGE_KEY);

/**
 * Inline script: apply theme before paint to avoid FOUC.
 * Sunset mode → NOAA daytime check (stored coords or US-center default).
 * Maps legacy `system` → light.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var c=${JSON.stringify(THEME_COOKIE_NAME)};var sk=${JSON.stringify(SUNSET_STORAGE_KEY)};${solarCheck};var sunset=false;try{sunset=localStorage.getItem(sk)==="1";}catch(e){}var t;if(sunset){t=pfIsDay(new Date())?"light":"dark";}else{t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){var m=document.cookie.match(new RegExp("(?:^|; )"+c+"=([^;]*)"));t=m?decodeURIComponent(m[1]):"light";}if(t==="system")t="light";if(t!=="light"&&t!=="dark")t="light";}var r=t==="dark";var e=document.documentElement;e.classList.toggle("dark",r);e.style.colorScheme=r?"dark":"light";}catch(e){}})();`;
