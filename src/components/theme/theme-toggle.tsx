"use client";

import { THEME_OPTIONS, type ThemePreference } from "@/lib/theme";
import { useTheme } from "@/components/theme/theme-provider";

export function ThemeToggle() {
  const { theme, sunset, setTheme, setSunset } = useTheme();

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Appearance</legend>
      <div
        className={`grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted p-1 ${
          sunset ? "opacity-50" : ""
        }`}
        role="radiogroup"
        aria-label="Color theme"
        aria-disabled={sunset}
      >
        {THEME_OPTIONS.map((option) => {
          const selected = !sunset && theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={sunset}
              onClick={() => setTheme(option.value as ThemePreference)}
              className={`min-h-11 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                selected
                  ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-accent/70"
                  : "text-muted-foreground hover:bg-card hover:text-foreground disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Sunset</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Light after sunrise, dark after sunset. Overrides light/dark.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={sunset}
          aria-label="Sunset theme"
          onClick={() => setSunset(!sunset)}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
            sunset ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-1 left-1 size-6 rounded-full bg-card shadow-sm transition-transform ${
              sunset ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </fieldset>
  );
}
