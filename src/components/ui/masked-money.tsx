"use client";

import { displayMoney } from "@/lib/money";
import { useHideMoney } from "@/lib/hide-money";

/**
 * Renders a currency amount, or a mask when the user hid financial info.
 */
export function MaskedMoney({
  amount,
  empty = "—",
  className,
}: {
  amount: number | null | undefined;
  empty?: string;
  className?: string;
}) {
  const { hideMoney } = useHideMoney();

  if (amount == null || Number.isNaN(Number(amount))) {
    return <span className={className}>{empty}</span>;
  }

  return (
    <span className={className} aria-label={hideMoney ? "Hidden amount" : undefined}>
      {displayMoney(Number(amount), hideMoney)}
    </span>
  );
}
