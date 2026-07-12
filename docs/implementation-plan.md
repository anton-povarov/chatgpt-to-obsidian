# Implementation Plan

> Historical architecture and build-order document. See [`PROGRESS.md`](../PROGRESS.md) for implemented state and [`TASKS.md`](../TASKS.md) for the authoritative remaining work.

## Product boundary

- Export the Current Conversation from the active `chatgpt.com` tab.
- Export only the Visible Branch; no history sidebar or batch export.
- Create an independent Conversation Snapshot on every export, named from the conversation title.
- Send Markdown to a configured Obsidian vault and folder through the clipboard-backed `obsidian://new` flow.
- Run entirely locally. Never export or persist authentication cookies or tokens.
- Target unpacked Chromium browsers, with Opera as the primary browser.

## Snapshot model

```ts
interface ConversationSnapshot {
  title: string;
  sourceUrl: string;
  exportedAt: string;
  tags: string[];
  exchanges: Exchange[];
}

interface Exchange {
  queryMarkdown: string;
  responseMarkdown: string;
  responseTimestamp?: string;
  responseDelaySeconds?: number;
  model?: string;
}

interface ExportProfile {
  vault: string;
  folder: string;
  defaultTags: string[];
  downloadImages: boolean;
}
```

## Extension boundaries

1. **Conversation collector** — a content script identifies message containers, walks the Visible Branch, and performs an automatic scroll pass for virtualized conversations. It restores the original scroll position and reports incomplete collection.
2. **Metadata enricher** — best-effort same-session lookup supplies timestamps and model names. Export remains available when enrichment fails.
3. **Markdown converter** — targeted conversion preserves code blocks, quotations, tables, lists, LaTeX, citations, links, and other reasonable semantic structure. It excludes ChatGPT application chrome.
4. **Snapshot renderer** — a pure module creates frontmatter and Exchange sections. Query lines become an Obsidian Query callout; response headings are lowered one level.
5. **Popup** — an Obsidian Web Clipper-inspired React UI exposes editable title, vault, folder, tags, Markdown preview, export progress, and actionable warnings.
6. **Vault bridge** — copies the final Markdown and invokes `obsidian://new` with file, vault, and silent parameters, with URI content as a clipboard-failure fallback.
7. **Profile storage** — persists one profile in extension-local storage. Per-export edits do not require multiple templates.

## Build order

1. Scaffold WXT, React, TypeScript, Manifest V3, linting, and tests.
2. Build fixture-driven extraction for ordinary ChatGPT exchanges.
3. Add Markdown conversion rules and snapshot rendering tests.
4. Add auto-scroll collection and incomplete-export detection.
5. Add best-effort model and timestamp enrichment.
6. Build the editable popup and single-profile settings.
7. Add clipboard and Obsidian URI export, then test in Opera and Chrome.
8. Add image-link behavior. Keep remote linking as the default; treat local image transfer as a focused compatibility spike because binary vault writes are separate from note creation.
9. Validate long conversations, regenerated branches, code, tables, LaTeX, citations, and partial metadata failures.

## Initial acceptance test

On a logged-in `chatgpt.com` conversation, opening the extension shows an editable Markdown snapshot of the complete visible branch. Exporting invokes Obsidian and creates a new note in the configured folder whose title matches the conversation title, whose exchanges render correctly in Obsidian's outline, and whose content contains no ChatGPT navigation or controls.

## Deferred fidelity enhancements

- Infer unmarked code blocks in user queries and wrap them in fenced Markdown when confidence is high.
  - Focus on user query messages only, don't try to detect anything in responses
  - Consider things like assembly listings (arm64 and x86_64) and small source examples such as C/C++/Rust programs without changing ordinary prose into code accidentally.
