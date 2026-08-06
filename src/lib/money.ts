export const MONEY_MASK = "••••";

export function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format amount, or return a mask when hideMoney is true. */
export function displayMoney(amount: number, hideMoney: boolean): string {
  return hideMoney ? MONEY_MASK : formatCurrency(amount);
}
