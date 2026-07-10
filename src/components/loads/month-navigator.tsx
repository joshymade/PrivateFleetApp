import Link from "next/link";
import {
  formatMonthLabel,
  shiftYearMonth,
  yearMonthString,
} from "@/lib/loads/date";

export function MonthNavigator({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const prev = shiftYearMonth(year, month, -1);
  const next = shiftYearMonth(year, month, 1);

  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={`/loads?month=${yearMonthString(prev.year, prev.month)}`}
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-border text-foreground"
        aria-label="Previous month"
      >
        ‹
      </Link>
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {formatMonthLabel(year, month)}
      </h2>
      <Link
        href={`/loads?month=${yearMonthString(next.year, next.month)}`}
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-border text-foreground"
        aria-label="Next month"
      >
        ›
      </Link>
    </div>
  );
}
