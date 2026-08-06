"use client";

import { Eye, EyeOff } from "lucide-react";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";
import { useHideMoney } from "@/lib/hide-money";

const HIDE_MONEY_HELP =
  "Hide your financial information across the entire app. Earnings and money amounts are replaced with dots until you show them again.";

/**
 * Eye toggle under the notification bell — persists hide-money preference.
 */
export function HideMoneyToggle() {
  const { hideMoney, toggleHideMoney } = useHideMoney();

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={toggleHideMoney}
        aria-pressed={hideMoney}
        aria-label={
          hideMoney ? "Show earnings and money amounts" : "Hide earnings and money amounts"
        }
        title={hideMoney ? "Show money" : "Hide money"}
        className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground outline-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {hideMoney ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
      <ClickableTooltip
        ariaLabel="About hiding financial information"
        className="text-muted-foreground"
        content={HIDE_MONEY_HELP}
        tooltipAlign="end"
      >
        <span className="sr-only">About hiding money</span>
      </ClickableTooltip>
    </div>
  );
}
