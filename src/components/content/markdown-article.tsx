import type { ReactNode } from "react";
import type {
  MarkdownBlock,
  MarkdownInline,
} from "@/lib/content/markdown";

const headingClassName: Record<1 | 2 | 3, string> = {
  1: "text-xl font-semibold",
  2: "text-base font-semibold",
  3: "text-sm font-semibold",
};

export function MarkdownArticle({
  blocks,
  className = "space-y-4 text-sm text-foreground",
}: {
  blocks: MarkdownBlock[];
  className?: string;
}) {
  return (
    <article className={className}>
      {blocks.map((block, index) => (
        <MarkdownBlockView key={index} block={block} />
      ))}
    </article>
  );
}

function MarkdownBlockView({ block }: { block: MarkdownBlock }) {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.depth}` as "h1" | "h2" | "h3";
      return (
        <Tag className={headingClassName[block.depth]}>
          <InlineNodes nodes={block.children} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p>
          <InlineNodes nodes={block.children} />
        </p>
      );
    case "blockquote":
      return (
        <p className="text-xs text-muted-foreground">
          <InlineNodes nodes={block.children} />
        </p>
      );
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          className={
            block.ordered
              ? "list-decimal space-y-2 pl-5"
              : "list-disc space-y-2 pl-5"
          }
        >
          {block.items.map((item, index) => (
            <li key={index}>
              <InlineNodes nodes={item} />
            </li>
          ))}
        </ListTag>
      );
    }
    case "hr":
      return <hr className="border-border" />;
    default:
      return null;
  }
}

function InlineNodes({ nodes }: { nodes: MarkdownInline[] }) {
  return (
    <>
      {nodes.map((node, index) => (
        <InlineNode key={index} node={node} />
      ))}
    </>
  );
}

function InlineNode({ node }: { node: MarkdownInline }): ReactNode {
  switch (node.type) {
    case "text":
      return node.value;
    case "strong":
      return (
        <strong className="font-semibold">
          <InlineNodes nodes={node.children} />
        </strong>
      );
    case "em":
      return (
        <em>
          <InlineNodes nodes={node.children} />
        </em>
      );
    case "code":
      return (
        <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {node.value}
        </code>
      );
    case "link":
      return (
        <a href={node.href} className="text-brand underline">
          <InlineNodes nodes={node.children} />
        </a>
      );
    default:
      return null;
  }
}
