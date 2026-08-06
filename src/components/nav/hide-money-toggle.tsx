"use client";

import { Eye, EyeOff } from "lucide-react";
import { ClickableTooltip } from "@/components/ui/clickable-tooltip";
import { useHideMoney } from "@/lib/hide-money";

const HIDE_MONEY_HELP =
  "Hide your financial information across the entire app. Earnings and money amounts are replaced with dots until you show them again.";

/**
 * Eye toggle beside the notification bell — persists hide-money preference.
 */
export function HideMoneyToggle() {
  const { hideMoney, toggleHideMoney } = useHideMoney();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={toggleHideMoney}
        aria-pressed={hideMoney}
        aria-label={
          hideMoney ? "Show earnings and money amounts" : "Hide earnings and money amounts"
        }
        title={hideMoney ? "Show money" : "Hide money"}
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        {hideMoney ? (
          <EyeOff className="h-5 w-5" aria-hidden />
        ) : (
          <Eye className="h-5 w-5" aria-hidden />
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
