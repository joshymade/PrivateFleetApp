"use client";

import { THEME_OPTIONS, type ThemePreference } from "@/lib/theme";
import { useTheme } from "@/components/theme/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Appearance</legend>
      <div
        className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted p-1"
        role="radiogroup"
        aria-label="Color theme"
      >
        {THEME_OPTIONS.map((option) => {
          const selected = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(option.value as ThemePreference)}
              className={`min-h-11 rounded-lg px-3 text-sm font-medium transition-colors ${
                selected
                  ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-accent/70"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
