"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useHideMoney } from "@/lib/hide-money";
import { displayMoney, MONEY_MASK } from "@/lib/money";
import type { WorkWeekChartSeries } from "@/lib/loads/queries";

export function LoadsWeekCharts({ weeks }: { weeks: WorkWeekChartSeries[] }) {
  const { hideMoney } = useHideMoney();

  if (weeks.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No work-week data for this month yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {weeks.map((week) => (
        <div
          key={week.weekStart}
          className="rounded-2xl border border-border bg-background p-4"
        >
          <h3 className="text-sm font-semibold text-foreground">
            {week.weekLabel}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Earnings and driven miles by day
          </p>
          <div className="mt-3 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week.days} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="miles"
                  tick={{ fontSize: 11 }}
                  width={36}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="pay"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  width={40}
                  tickFormatter={(v: number) =>
                    hideMoney ? MONEY_MASK : `$${v}`
                  }
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "earnings") {
                      return [
                        displayMoney(Number(value), hideMoney),
                        "Earnings",
                      ];
                    }
                    if (name === "driven") {
                      return [value, "Driven mi"];
                    }
                    if (name === "paid") {
                      return [value, "Paid mi"];
                    }
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
                    value === "earnings"
                      ? "Earnings"
                      : value === "driven"
                        ? "Driven"
                        : value === "paid"
                          ? "Paid"
                          : value
                  }
                />
                <Bar
                  yAxisId="miles"
                  dataKey="driven"
                  fill="var(--color-brand, #0f766e)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                />
                <Bar
                  yAxisId="miles"
                  dataKey="paid"
                  fill="var(--color-accent, #f59e0b)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                />
                <Bar
                  yAxisId="pay"
                  dataKey="earnings"
                  fill="var(--color-primary, #1e293b)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
