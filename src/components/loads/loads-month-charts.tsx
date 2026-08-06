"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useHideMoney } from "@/lib/hide-money";
import type { MonthChartDay } from "@/lib/loads/queries";
import { displayMoney, MONEY_MASK } from "@/lib/money";
import {
  buildUnpaidMilesPieSlices,
  formatMilesNumber,
  formatSignedMiles,
  unpaidMilesDisplay,
  unpaidMilesToneClass,
} from "@/lib/loads/unpaid-miles";

const BRAND = "var(--color-brand)";
const CHART_MARGIN = { top: 4, right: 4, left: 0, bottom: 0 };

function dayTickInterval(dayCount: number): number {
  if (dayCount <= 10) return 0;
  if (dayCount <= 20) return 1;
  return 2;
}

/** Month miles pie: Paid + Driven + unpaid gap (red/green), unpaid last. */
function MilesDrivenPie({ days }: { days: MonthChartDay[] }) {
  const drivenTotal = days.reduce((sum, d) => sum + d.driven, 0);
  const paidTotal = days.reduce((sum, d) => sum + d.paid, 0);
  const data = buildUnpaidMilesPieSlices(drivenTotal, paidTotal);
  const unpaidDisplay = unpaidMilesDisplay(drivenTotal, paidTotal);

  if (data.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">Miles Driven</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Paid vs driven; unpaid gap is red shortfall or green extra paid
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-40 w-[55%] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={58}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatMilesNumber(Number(value)),
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-2 text-sm">
          {data.map((entry) => (
            <li key={entry.name} className="flex items-start gap-2">
              <span
                className="mt-1.5 size-2.5 shrink-0 rounded-sm"
                style={{ background: entry.color }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{entry.name}</p>
                <p
                  className={`font-semibold tabular-nums ${
                    entry.isUnpaid
                      ? unpaidMilesToneClass(unpaidDisplay)
                      : "text-foreground"
                  }`}
                >
                  {entry.isUnpaid
                    ? formatSignedMiles(unpaidDisplay)
                    : formatMilesNumber(entry.value)}
                </p>
              </div>
            </li>
          ))}
          <li className="border-t border-border pt-2 text-xs text-muted-foreground">
            Driven {formatMilesNumber(drivenTotal)} · Paid{" "}
            {formatMilesNumber(paidTotal)}
          </li>
        </ul>
      </div>
    </div>
  );
}

function EarningsChart({ days }: { days: MonthChartDay[] }) {
  const { hideMoney } = useHideMoney();
  const activeDays = days.filter((d) => d.earnings > 0);
  if (activeDays.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">Daily earnings</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Pay by day for the month
      </p>
      <div className="mt-3 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activeDays} margin={CHART_MARGIN} barCategoryGap="20%">
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-border"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval={dayTickInterval(activeDays.length)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              width={40}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                hideMoney ? MONEY_MASK : `$${v}`
              }
            />
            <Tooltip
              formatter={(value: number) => [
                displayMoney(Number(value), hideMoney),
                "Earnings",
              ]}
              labelFormatter={(_, payload) => {
                const date = payload?.[0]?.payload?.date as string | undefined;
                return date ?? "";
              }}
            />
            <Bar
              dataKey="earnings"
              fill={BRAND}
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LoadsMonthCharts({ days }: { days: MonthChartDay[] }) {
  const hasData = days.some(
    (d) => d.loads > 0 || d.driven > 0 || d.paid > 0 || d.earnings > 0,
  );

  if (!hasData) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No completed load data for this month yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <MilesDrivenPie days={days} />
      <EarningsChart days={days} />
    </div>
  );
}
