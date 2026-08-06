import type { ReactNode } from "react";
import { sectionHeadingColorClassName } from "@/components/ui/page-title";

type AccountSettingsSectionProps = {
  title: string;
  /** Stable id for aria-labelledby; defaults from title. */
  id?: string;
  description?: string;
  children: ReactNode;
  /**
   * When true, skip card chrome (for link lists that already use bordered rows).
   */
  bare?: boolean;
};

function sectionIdFromTitle(title: string): string {
  return `account-section-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export function AccountSettingsSection({
  title,
  id,
  description,
  children,
  bare = false,
}: AccountSettingsSectionProps) {
  const headingId = id ?? sectionIdFromTitle(title);

  return (
    <section
      aria-labelledby={headingId}
      className={
        bare
          ? "flex flex-col gap-2"
          : "flex flex-col gap-4 rounded-2xl border border-border bg-card p-4"
      }
    >
      <header className="flex flex-col gap-1">
        <h2
          id={headingId}
          className={`text-sm font-semibold ${sectionHeadingColorClassName}`}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
