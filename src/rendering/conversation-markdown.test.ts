import { describe, expect, it } from "vitest";

import {
  demoteMarkdownHeadings,
  formatObsidianDateTime,
  renderConversationBody,
  renderConversationDocument,
} from "./conversation-markdown";

describe("Conversation Markdown rendering", () => {
  const draft = {
    title: "Parser design",
    sourceUrl: "https://chatgpt.com/c/123",
    exchanges: [
      {
        queryMarkdown: "Build a parser\n\n```ts\ntype Node = string;\n```",
        responseMarkdown: "# Start here\n\n## Details",
        responseTimestamp: "2026-07-12 14:33",
        responseDelaySeconds: 44,
        model: "GPT-5.5 Thinking",
      },
    ],
  };

  it("renders an editable body without frontmatter", () => {
    const markdown = renderConversationBody(draft);

    expect(markdown).not.toContain("---");
    expect(markdown).not.toContain("title:");
    expect(markdown).toContain("# Exchange 1 — Build a parser");
    expect(markdown).toContain("> [!Query]\n> Build a parser\n>\n> ```ts");
    expect(markdown).toContain(
      "*2026-07-12 14:33 · 44 sec · GPT-5.5 Thinking*",
    );
    expect(markdown).toContain("## Start here\n\n### Details");
  });

  it("prepends frontmatter from current document fields only when saving", () => {
    const body = renderConversationBody(draft);
    const markdown = renderConversationDocument(body, {
      title: 'Edited: "title"',
      sourceUrl: draft.sourceUrl,
      exportedAt: "2026-07-12 14:34:00",
      tags: ["chatgpt", "current document"],
    });

    expect(markdown).toContain('title: "Edited: \\"title\\""');
    expect(markdown).toContain('source: "https://chatgpt.com/c/123"');
    expect(markdown).toContain("exported: 2026-07-12 14:34:00");
    expect(markdown).toContain('  - "current document"');
    expect(markdown.endsWith(body)).toBe(true);
  });

  it("uses only the first query line in the Exchange heading", () => {
    const markdown = renderConversationBody({
      title: "Assembly",
      sourceUrl: "https://chatgpt.com/c/arm64",
      exchanges: [
        {
          queryMarkdown:
            "explain this arm64 assembly\nstp x29, x30, [sp, #-16]!\nret",
          responseMarkdown: "It creates a stack frame.",
        },
      ],
    });

    expect(markdown).toContain(
      "# Exchange 1 — explain this arm64 assembly\n\n",
    );
    expect(markdown).toContain(
      "> [!Query]\n> explain this arm64 assembly\n> stp x29, x30, [sp, #-16]!\n> ret",
    );
    expect(markdown).not.toContain(
      "# Exchange 1 — explain this arm64 assembly stp",
    );
  });
});

describe("formatObsidianDateTime", () => {
  it("formats an ISO instant without milliseconds or timezone suffix", () => {
    expect(formatObsidianDateTime(new Date("2026-07-11T22:42:36.081Z"))).toBe(
      "2026-07-11 22:42:36",
    );
  });
});

describe("demoteMarkdownHeadings", () => {
  it("does not alter hash-prefixed lines inside fenced code", () => {
    expect(
      demoteMarkdownHeadings("# Heading\n```md\n# Not a heading\n```"),
    ).toBe("## Heading\n```md\n# Not a heading\n```");
  });
});
