export const THEME_STORAGE_KEY = "pf-theme";
export const THEME_COOKIE_NAME = "pf-theme";

/** Resolved appearance only — no system preference mode. */
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

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  return preference;
}

/** Inline script: apply theme before paint to avoid FOUC. Maps legacy `system` → light. */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var c=${JSON.stringify(THEME_COOKIE_NAME)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){var m=document.cookie.match(new RegExp("(?:^|; )"+c+"=([^;]*)"));t=m?decodeURIComponent(m[1]):"light";}if(t==="system")t="light";if(t!=="light"&&t!=="dark")t="light";var r=t==="dark";var e=document.documentElement;e.classList.toggle("dark",r);e.style.colorScheme=r?"dark":"light";}catch(e){}})();`;
