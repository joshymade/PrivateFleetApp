"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createAdpEntry } from "@/app/(app)/account/actions";
import { MaskedMoney } from "@/components/ui/masked-money";
import { useHideMoney } from "@/lib/hide-money";
import { displayMoney } from "@/lib/money";
import { toDateString } from "@/lib/loads/date";
import type { AdpEntry } from "@/types/database";

function defaultPeriodStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return toDateString(d);
}

function defaultPeriodEnd(start: string): string {
  const [y, m, d] = start.split("-").map(Number);
  return toDateString(new Date(y, m - 1, d + 13));
}

export function AdpHistorySection({ entries }: { entries: AdpEntry[] }) {
  const router = useRouter();
  const { hideMoney } = useHideMoney();
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(() =>
    defaultPeriodEnd(defaultPeriodStart()),
  );
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const chartData = useMemo(
    () =>
      [...entries]
        .sort((a, b) => a.period_start.localeCompare(b.period_start))
        .map((e) => ({
          label: e.period_start.slice(5),
          adp: Number(e.adp_amount),
          full: e.period_start,
        })),
    [entries],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await createAdpEntry({
        periodStart,
        periodEnd,
        adpAmount: Number(amount),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAmount("");
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {chartData.length > 0 ? (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={40} />
              <Tooltip
                formatter={(value: number) => [
                  displayMoney(Number(value), hideMoney),
                  "ADP",
                ]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.full
                    ? `Period starting ${payload[0].payload.full}`
                    : ""
                }
              />
              <Line
                type="monotone"
                dataKey="adp"
                stroke="var(--color-brand, #0f766e)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No ADP entries yet.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm" htmlFor="adp-period-start">
            <span className="mb-1 block font-medium">Period start</span>
            <input
              id="adp-period-start"
              type="date"
              required
              value={periodStart}
              onChange={(e) => {
                setPeriodStart(e.target.value);
                setPeriodEnd(defaultPeriodEnd(e.target.value));
              }}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
            />
          </label>
          <label className="block text-sm" htmlFor="adp-period-end">
            <span className="mb-1 block font-medium">Period end</span>
            <input
              id="adp-period-end"
              type="date"
              required
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
            />
          </label>
        </div>
        <label className="block text-sm" htmlFor="adp-amount">
          <span className="mb-1 block font-medium">ADP amount ($)</span>
          <input
            id="adp-amount"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 285.00"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
          />
        </label>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            ADP saved.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add pay-period ADP"}
        </button>
      </form>

      {entries.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {[...entries]
            .sort((a, b) => b.period_start.localeCompare(a.period_start))
            .slice(0, 8)
            .map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {e.period_start} → {e.period_end}
                </span>
                <span className="font-medium tabular-nums">
                  <MaskedMoney amount={Number(e.adp_amount)} />
                </span>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
