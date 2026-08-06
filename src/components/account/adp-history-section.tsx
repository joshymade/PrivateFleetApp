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
import {
  formatPayPeriodLabel,
  previousPayPeriods,
  todayDateString,
} from "@/lib/loads/date";
import type { AdpEntry } from "@/types/database";

const PREVIOUS_PERIOD_OPTIONS = 12;

export function AdpHistorySection({
  entries,
  payPeriodStart,
  nextPayDate,
}: {
  entries: AdpEntry[];
  payPeriodStart: string | null;
  nextPayDate: string | null;
}) {
  const router = useRouter();
  const { hideMoney } = useHideMoney();
  const seedReady = Boolean(payPeriodStart && nextPayDate);

  const priorPeriods = useMemo(() => {
    if (!payPeriodStart || !nextPayDate) return [];
    return previousPayPeriods(
      todayDateString(),
      payPeriodStart,
      nextPayDate,
      PREVIOUS_PERIOD_OPTIONS,
    );
  }, [payPeriodStart, nextPayDate]);

  const amountByStart = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.period_start, Number(e.adp_amount));
    }
    return map;
  }, [entries]);

  const [selectedStart, setSelectedStart] = useState(
    () => priorPeriods[0]?.start ?? "",
  );
  const selectedPeriod =
    priorPeriods.find((p) => p.start === selectedStart) ??
    priorPeriods[0] ??
    null;

  const [amount, setAmount] = useState(() => {
    const start = priorPeriods[0]?.start;
    if (!start) return "";
    const existing = amountByStart.get(start);
    return existing != null && Number.isFinite(existing)
      ? String(existing)
      : "";
  });
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

  function onSelectPeriod(start: string) {
    setSelectedStart(start);
    setSaved(false);
    setError(null);
    const existing = amountByStart.get(start);
    setAmount(
      existing != null && Number.isFinite(existing) ? String(existing) : "",
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!selectedPeriod) {
      setError("Pick a previous pay period.");
      return;
    }
    startTransition(async () => {
      const result = await createAdpEntry({
        periodStart: selectedPeriod.start,
        periodEnd: selectedPeriod.end,
        adpAmount: Number(amount),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
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

      {!seedReady ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          Set your pay period above first. ADP uses previous biweekly periods
          from that deposit cadence.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm" htmlFor="adp-period">
            <span className="mb-1 block font-medium">Previous pay period</span>
            <select
              id="adp-period"
              required
              value={selectedPeriod?.start ?? ""}
              onChange={(e) => onSelectPeriod(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
            >
              {priorPeriods.map((p) => {
                const hasEntry = amountByStart.has(p.start);
                return (
                  <option key={p.start} value={p.start}>
                    {formatPayPeriodLabel(p.start, p.end)}
                    {hasEntry ? " (saved)" : ""}
                  </option>
                );
              })}
            </select>
            <span className="mt-1 block text-xs text-muted-foreground">
              ADP posts on payday for the period that just ended — pick that
              previous window.
            </span>
          </label>
          <label className="block text-sm" htmlFor="adp-amount">
            <span className="mb-1 block font-medium">ADP amount ($)</span>
            <input
              id="adp-amount"
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setSaved(false);
              }}
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
            disabled={pending || !selectedPeriod}
            className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save ADP"}
          </button>
        </form>
      )}

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
                  {formatPayPeriodLabel(e.period_start, e.period_end)}
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
