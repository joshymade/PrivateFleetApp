import { notFound } from "next/navigation";
import { BackLink } from "@/components/nav/back-link";
import { MarkdownArticle } from "@/components/content/markdown-article";
import { pageTitleClassName } from "@/components/ui/page-title";
import type { MarkdownDocument } from "@/lib/content/markdown";

export function ContentDocPage({
  doc,
  backHref = "/account/legal",
  backLabel = "Legal",
}: {
  doc: MarkdownDocument | null;
  backHref?: string;
  backLabel?: string;
}) {
  if (!doc) notFound();

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 p-4 pb-8 pt-3">
      <BackLink href={backHref} aria-label={`Back to ${backLabel}`}>
        {backLabel}
      </BackLink>
      <div>
        <h1 className={pageTitleClassName}>{doc.title}</h1>
        {doc.subtitle ? (
          <p className="mt-1 text-xs text-muted-foreground">{doc.subtitle}</p>
        ) : null}
      </div>
      <MarkdownArticle blocks={doc.blocks} />
    </main>
  );
}
