"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  persistSolarCoords,
  readStoredSolarCoords,
  resolveSolarTheme,
  type SolarCoords,
} from "@/lib/solar";
import {
  normalizeSunsetPreference,
  normalizeThemePreference,
  resolveTheme,
  SUNSET_STORAGE_KEY,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemePreference;
  /** True when Sunrise/Sunset auto mode is on (overrides manual light/dark). */
  sunset: boolean;
  resolved: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
  setSunset: (enabled: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", emitChange);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", emitChange);
  };
}

function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return normalizeThemePreference(stored);
  } catch {
    /* ignore */
  }
  return "light";
}

function readStoredSunset(): boolean {
  try {
    return normalizeSunsetPreference(localStorage.getItem(SUNSET_STORAGE_KEY));
  } catch {
    /* ignore */
  }
  return false;
}

function getThemeSnapshot(): ThemePreference {
  return readStoredTheme();
}

function getServerThemeSnapshot(): ThemePreference {
  return "light";
}

function getSunsetSnapshot(): boolean {
  return readStoredSunset();
}

function getServerSunsetSnapshot(): boolean {
  return false;
}

function persistTheme(theme: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)};path=/;max-age=${maxAge};samesite=lax`;
}

function persistSunset(enabled: boolean) {
  try {
    localStorage.setItem(SUNSET_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function applyResolved(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

function requestSolarCoords(): Promise<SolarCoords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 86_400_000, timeout: 8_000 },
    );
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const sunset = useSyncExternalStore(
    subscribe,
    getSunsetSnapshot,
    getServerSunsetSnapshot,
  );
  const [coords, setCoords] = useState<SolarCoords>(() =>
    typeof window === "undefined"
      ? { lat: 39.8283, lng: -98.5795 }
      : readStoredSolarCoords(),
  );
  const [nowTick, setNowTick] = useState(0);

  // Recompute when coords change or nowTick bumps (interval / visibility).
  void nowTick;
  const solarResolved = resolveSolarTheme(new Date(), coords);

  const resolved = resolveTheme(theme, {
    sunset,
    solarResolved,
  });

  useLayoutEffect(() => {
    applyResolved(resolved);
  }, [resolved]);

  // Refresh solar theme on an interval and when the tab becomes visible.
  useEffect(() => {
    if (!sunset) return;

    const bump = () => setNowTick((n) => n + 1);
    const id = window.setInterval(bump, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [sunset]);

  // Prefer device location for sunrise/sunset; fall back to stored / US-center.
  useEffect(() => {
    if (!sunset) return;
    let cancelled = false;
    void requestSolarCoords().then((next) => {
      if (cancelled || !next) return;
      persistSolarCoords(next);
      setCoords(next);
      emitChange();
    });
    return () => {
      cancelled = true;
    };
  }, [sunset]);

  const setTheme = useCallback((next: ThemePreference) => {
    // Manual pick turns off sunset so the choice sticks.
    persistSunset(false);
    persistTheme(next);
    applyResolved(resolveTheme(next));
    emitChange();
  }, []);

  const setSunset = useCallback(
    (enabled: boolean) => {
      persistSunset(enabled);
      if (enabled) {
        const nextCoords = readStoredSolarCoords();
        setCoords(nextCoords);
        const solar = resolveSolarTheme(new Date(), nextCoords);
        applyResolved(solar);
        void requestSolarCoords().then((geo) => {
          if (!geo) return;
          persistSolarCoords(geo);
          setCoords(geo);
          applyResolved(resolveSolarTheme(new Date(), geo));
          emitChange();
        });
      } else {
        applyResolved(resolveTheme(readStoredTheme()));
      }
      emitChange();
    },
    [],
  );

  const value = useMemo(
    () => ({ theme, sunset, resolved, setTheme, setSunset }),
    [theme, sunset, resolved, setTheme, setSunset],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
