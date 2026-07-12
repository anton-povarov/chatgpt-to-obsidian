import type { ConversationDraft } from "../domain/conversation-draft";
import type { Exchange } from "../domain/conversation-snapshot";

export interface ConversationDocumentMetadata {
  title: string;
  sourceUrl: string;
  exportedAt: string;
  tags: string[];
}

export function formatObsidianDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function renderConversationBody(draft: ConversationDraft): string {
  return draft.exchanges.map(renderExchange).join("\n\n").trimEnd();
}

export function renderConversationDocument(
  bodyMarkdown: string,
  metadata: ConversationDocumentMetadata,
): string {
  return `${renderFrontmatter(metadata)}\n\n${bodyMarkdown}`.trimEnd();
}

function renderFrontmatter(metadata: ConversationDocumentMetadata): string {
  const tags =
    metadata.tags.length === 0
      ? "tags: []"
      : ["tags:", ...metadata.tags.map((tag) => `  - ${yamlString(tag)}`)].join(
          "\n",
        );

  return [
    "---",
    `title: ${yamlString(metadata.title)}`,
    `source: ${yamlString(metadata.sourceUrl)}`,
    `exported: ${metadata.exportedAt}`,
    tags,
    "---",
  ].join("\n");
}

function renderExchange(exchange: Exchange, index: number): string {
  const queryLines = exchange.queryMarkdown.split(/\r?\n/);
  const firstQueryLine = queryLines.shift()?.trim() || "Query";
  const headingTitle = cleanHeadingTitle(firstQueryLine);
  const queryBody = queryLines
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
  const callout = [`> [!Query]\n> ${firstQueryLine}`, queryBody]
    .filter(Boolean)
    .join("\n");
  const metadata = renderResponseMetadata(exchange);
  const response = demoteMarkdownHeadings(exchange.responseMarkdown);

  return [
    `# Exchange ${index + 1} — ${headingTitle}`,
    callout,
    metadata,
    response,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function renderResponseMetadata(exchange: Exchange): string {
  const parts = [
    exchange.responseTimestamp,
    exchange.responseDelaySeconds === undefined
      ? undefined
      : `${exchange.responseDelaySeconds} sec`,
    exchange.model,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? `*${parts.join(" · ")}*` : "";
}

export function demoteMarkdownHeadings(markdown: string): string {
  let activeFence: { marker: "`" | "~"; length: number } | undefined;

  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const fence = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
      if (fence) {
        const marker = fence[0] as "`" | "~";
        if (!activeFence) {
          activeFence = { marker, length: fence.length };
        } else if (
          activeFence.marker === marker &&
          fence.length >= activeFence.length
        ) {
          activeFence = undefined;
        }
        return line;
      }

      if (activeFence) {
        return line;
      }

      return line.replace(
        /^(#{1,6})(\s+)/,
        (_match, hashes: string, spacing: string) => {
          return `${"#".repeat(Math.min(6, hashes.length + 1))}${spacing}`;
        },
      );
    })
    .join("\n");
}

function cleanHeadingTitle(value: string): string {
  return value
    .replace(/^#+\s*/, "")
    .replace(/!?(?:\[([^\]]*)\])\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .trim();
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}
