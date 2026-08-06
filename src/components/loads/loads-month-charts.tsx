"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useHideMoney } from "@/lib/hide-money";
import type { MonthChartDay } from "@/lib/loads/queries";
import { displayMoney, MONEY_MASK } from "@/lib/money";

const CHART_MARGIN = { top: 4, right: 8, left: 0, bottom: 0 };

function dayTickInterval(dayCount: number): number {
  if (dayCount <= 10) return 0;
  if (dayCount <= 20) return 1;
  return 2;
}

function MilesVsPaidChart({ days }: { days: MonthChartDay[] }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">Miles driven vs paid</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Daily driven miles (bars) and paid miles (line) for the month
      </p>
      <div className="mt-3 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={days} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval={dayTickInterval(days.length)}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              width={36}
              allowDecimals={false}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "driven") return [value, "Driven mi"];
                if (name === "paid") return [value, "Paid mi"];
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
                value === "driven" ? "Driven" : value === "paid" ? "Paid" : value
              }
            />
            <Bar
              dataKey="driven"
              fill="var(--color-brand, #0f766e)"
              radius={[3, 3, 0, 0]}
              maxBarSize={12}
            />
            <Line
              type="monotone"
              dataKey="paid"
              stroke="var(--color-accent, #f59e0b)"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EarningsChart({ days }: { days: MonthChartDay[] }) {
  const { hideMoney } = useHideMoney();

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">Daily earnings</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Pay amount by day for the month
      </p>
      <div className="mt-3 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={days} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval={dayTickInterval(days.length)}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              width={44}
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
            <Line
              type="monotone"
              dataKey="earnings"
              stroke="var(--color-primary, #1e293b)"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
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
      <MilesVsPaidChart days={days} />
      <EarningsChart days={days} />
    </div>
  );
}
