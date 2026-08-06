import { readFile } from "node:fs/promises";
import path from "node:path";

export type MarkdownInline =
  | { type: "text"; value: string }
  | { type: "strong"; children: MarkdownInline[] }
  | { type: "em"; children: MarkdownInline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: MarkdownInline[] };

export type MarkdownBlock =
  | { type: "heading"; depth: 1 | 2 | 3; children: MarkdownInline[] }
  | { type: "paragraph"; children: MarkdownInline[] }
  | { type: "blockquote"; children: MarkdownInline[] }
  | { type: "list"; ordered: boolean; items: MarkdownInline[][] }
  | { type: "hr" };

export type MarkdownDocument = {
  slug: string;
  title: string;
  subtitle: string | null;
  blocks: MarkdownBlock[];
};

const CONTENT_DIR = path.join(process.cwd(), "content");
const DOC_MARKER = /<!--\s*@doc:([a-z0-9-]+)\s*-->/i;

export async function readContentMarkdown(filename: string): Promise<string> {
  const filePath = path.join(CONTENT_DIR, filename);
  return readFile(filePath, "utf8");
}

export async function loadFaqDocument(): Promise<MarkdownDocument> {
  const raw = await readContentMarkdown("faq.md");
  return parseSingleDocument(raw, "faq");
}

export async function loadLegalDocument(
  slug: string,
): Promise<MarkdownDocument | null> {
  const raw = await readContentMarkdown("legal.md");
  const docs = splitLegalDocuments(raw);
  return docs.find((doc) => doc.slug === slug) ?? null;
}

function splitLegalDocuments(raw: string): MarkdownDocument[] {
  const parts = raw.split(DOC_MARKER);
  const docs: MarkdownDocument[] = [];

  // split yields: [preamble, slug1, body1, slug2, body2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const slug = parts[i]?.trim();
    const body = parts[i + 1] ?? "";
    if (!slug) continue;
    docs.push(parseSingleDocument(body, slug));
  }

  return docs;
}

function parseSingleDocument(raw: string, fallbackSlug: string): MarkdownDocument {
  const withoutComments = raw.replace(/<!--[\s\S]*?-->/g, "").trim();
  const blocks = parseMarkdownBlocks(withoutComments);

  let title = fallbackSlug;
  let subtitle: string | null = null;
  const body: MarkdownBlock[] = [];

  for (const block of blocks) {
    if (block.type === "heading" && block.depth === 1 && title === fallbackSlug) {
      title = inlineToPlainText(block.children);
      continue;
    }
    if (block.type === "blockquote" && subtitle === null && body.length === 0) {
      subtitle = inlineToPlainText(block.children);
      continue;
    }
    body.push(block);
  }

  return { slug: fallbackSlug, title, subtitle, blocks: body };
}

export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const depth = heading[1]!.length as 1 | 2 | 3;
      blocks.push({
        type: "heading",
        depth,
        children: parseInline(heading[2]!.trim()),
      });
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
        quoteLines.push((lines[i] ?? "").trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({
        type: "blockquote",
        children: parseInline(quoteLines.join(" ")),
      });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: MarkdownInline[][] = [];
      while (i < lines.length && /^[-*]\s+/.test((lines[i] ?? "").trim())) {
        items.push(parseInline((lines[i] ?? "").trim().replace(/^[-*]\s+/, "")));
        i += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: MarkdownInline[][] = [];
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? "").trim())) {
        items.push(
          parseInline((lines[i] ?? "").trim().replace(/^\d+\.\s+/, "")),
        );
        i += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const current = (lines[i] ?? "").trim();
      if (
        !current ||
        /^---+$/.test(current) ||
        /^#{1,3}\s+/.test(current) ||
        current.startsWith(">") ||
        /^[-*]\s+/.test(current) ||
        /^\d+\.\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      i += 1;
    }
    blocks.push({
      type: "paragraph",
      children: parseInline(paragraphLines.join(" ")),
    });
  }

  return blocks;
}

function parseInline(text: string): MarkdownInline[] {
  const nodes: MarkdownInline[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|(?<!\*)\*(?!\*)([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const token = match[0];
    if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      nodes.push({
        type: "strong",
        children: parseInline(token.slice(2, -2)),
      });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push({ type: "code", value: token.slice(1, -1) });
    } else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push({
          type: "link",
          href: linkMatch[2]!,
          children: parseInline(linkMatch[1]!),
        });
      } else {
        nodes.push({ type: "text", value: token });
      }
    } else if (token.startsWith("*") || token.startsWith("_")) {
      nodes.push({
        type: "em",
        children: parseInline(token.slice(1, -1)),
      });
    } else {
      nodes.push({ type: "text", value: token });
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: "text", value: text.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", value: text }];
}

function inlineToPlainText(nodes: MarkdownInline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "code":
          return node.value;
        case "strong":
        case "em":
        case "link":
          return inlineToPlainText(node.children);
        default:
          return "";
      }
    })
    .join("");
}
