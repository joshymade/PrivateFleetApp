"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

const BRAND = "var(--color-brand)";
const ACCENT = "var(--color-accent)";
const CHART_MARGIN = { top: 4, right: 4, left: 0, bottom: 0 };

function dayTickInterval(dayCount: number): number {
  if (dayCount <= 10) return 0;
  if (dayCount <= 20) return 1;
  return 2;
}

function formatMiles(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Month totals pie — clearest aggregate Driven vs Paid comparison. */
function MilesTotalsPie({ days }: { days: MonthChartDay[] }) {
  const drivenTotal = days.reduce((sum, d) => sum + d.driven, 0);
  const paidTotal = days.reduce((sum, d) => sum + d.paid, 0);
  const data = [
    { name: "Driven miles", value: drivenTotal, color: BRAND },
    { name: "Paid miles", value: paidTotal, color: ACCENT },
  ];
  const hasSlice = drivenTotal > 0 || paidTotal > 0;

  if (!hasSlice) return null;

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">
        Driven versus Paid miles
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Month totals — odometer driven vs company paid
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
                  formatMiles(Number(value)),
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
                <p className="font-semibold tabular-nums text-foreground">
                  {formatMiles(entry.value)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Daily grouped bars — readable day-by-day Driven vs Paid without a busy composed chart. */
function MilesDailyBars({ days }: { days: MonthChartDay[] }) {
  const activeDays = days.filter((d) => d.driven > 0 || d.paid > 0);
  if (activeDays.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">
        Daily Driven versus Paid miles
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Side-by-side miles for each day with activity
      </p>
      <div className="mt-3 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activeDays} margin={CHART_MARGIN} barGap={2} barCategoryGap="18%">
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
              width={32}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "driven") return [formatMiles(value), "Driven miles"];
                if (name === "paid") return [formatMiles(value), "Paid miles"];
                return [value, name];
              }}
              labelFormatter={(_, payload) => {
                const date = payload?.[0]?.payload?.date as string | undefined;
                return date ?? "";
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) =>
                value === "driven"
                  ? "Driven miles"
                  : value === "paid"
                    ? "Paid miles"
                    : value
              }
            />
            <Bar
              dataKey="driven"
              fill={BRAND}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
            />
            <Bar
              dataKey="paid"
              fill={ACCENT}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
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
      <MilesTotalsPie days={days} />
      <MilesDailyBars days={days} />
      <EarningsChart days={days} />
    </div>
  );
}
