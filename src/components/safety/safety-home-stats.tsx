import Link from "next/link";
import { pageTitleClassName } from "@/components/ui/page-title";
import type { SafetyHomeStats } from "@/types/database";

const emptyStats: SafetyHomeStats = {
  total_reports: 0,
  pending_review: 0,
  reports_24h: 0,
  reports_30d: 0,
};

const cardTone = {
  total: {
    shell:
      "border-brand/35 bg-brand/10 dark:border-brand/45 dark:bg-brand/15",
    value: "text-brand dark:text-brand-strong",
    hover:
      "hover:border-brand/55 hover:bg-brand/15 dark:hover:border-brand/60 dark:hover:bg-brand/20 focus-visible:ring-brand",
  },
  pending: {
    shell:
      "border-accent/50 bg-accent/15 dark:border-accent/45 dark:bg-accent/10",
    value: "text-accent-foreground dark:text-accent",
    hover:
      "hover:border-accent/70 hover:bg-accent/25 dark:hover:border-accent/60 dark:hover:bg-accent/15 focus-visible:ring-accent",
  },
  recent: {
    shell:
      "border-emerald-500/35 bg-emerald-500/10 dark:border-emerald-400/40 dark:bg-emerald-400/10",
    value: "text-emerald-700 dark:text-emerald-300",
    hover:
      "hover:border-emerald-500/55 hover:bg-emerald-500/15 dark:hover:border-emerald-400/55 dark:hover:bg-emerald-400/15 focus-visible:ring-emerald-500",
  },
  month: {
    shell:
      "border-sky-500/35 bg-sky-500/10 dark:border-sky-400/40 dark:bg-sky-400/10",
    value: "text-sky-700 dark:text-sky-300",
    hover:
      "hover:border-sky-500/55 hover:bg-sky-500/15 dark:hover:border-sky-400/55 dark:hover:bg-sky-400/15 focus-visible:ring-sky-500",
  },
} as const;

type CardTone = keyof typeof cardTone;

function StatCard({
  value,
  label,
  href,
  tone,
}: {
  value: number;
  label: string;
  href?: string;
  tone: CardTone;
}) {
  const colors = cardTone[tone];
  const body = (
    <>
      <p
        className={`text-3xl font-semibold tracking-tight tabular-nums ${colors.value}`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm leading-snug text-muted-foreground">{label}</p>
    </>
  );

  const className = `rounded-2xl border p-4 ${colors.shell} ${
    href
      ? `transition-colors focus-visible:outline-none focus-visible:ring-2 ${colors.hover}`
      : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

export function SafetyHomeStatsGrid({
  stats,
}: {
  stats: SafetyHomeStats | null;
}) {
  const s = stats ?? emptyStats;

  return (
    <section className="space-y-3">
      <div>
        <h1 className={pageTitleClassName}>Safety overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fleet damage report activity and inbox status.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          value={s.total_reports}
          label="Total reports created"
          tone="total"
        />
        <StatCard
          value={s.pending_review}
          label="Pending review"
          href="/safety/inbox"
          tone="pending"
        />
        <StatCard value={s.reports_24h} label="Past 24 hours" tone="recent" />
        <StatCard value={s.reports_30d} label="Last 30 days" tone="month" />
      </div>
    </section>
  );
}
