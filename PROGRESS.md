# Project Progress

Last updated: 2026-07-12 (Asia/Dubai)

## Objective

Build a personal, unpacked Chromium extension that exports the Current Conversation from `chatgpt.com` as a high-fidelity Markdown Conversation Snapshot in a predefined Obsidian vault folder. Opera is the primary browser. No OpenAI API key is required.

## Current state

The extension builds, loads in Opera, connects its popup to the active ChatGPT tab, automatically scrolls through the Conversation to collect the Visible Branch, converts rendered messages to Markdown, and presents an editable Markdown preview. It does not yet save to Obsidian.

Verified manually in Opera:

- `output/chrome-mv3` loads as an unpacked extension.
- The toolbar popup opens on a private ChatGPT conversation.
- Popup-to-content-script messaging works through Chromium's `sendResponse` callback.
- Conversation content is extracted without the sidebar or surrounding ChatGPT controls.
- Queries render as Obsidian Question callouts.
- Multiline user queries retain their line breaks.
- Exchange headings use only the first query line.
- The human-readable export timestamp renders as `YYYY-MM-DD HH:mm:ss` in UTC.

Verified automatically:

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm test` passes: 17 tests across 5 files.
- `npm run build` passes and produces `output/chrome-mv3`.

## Implemented behavior

### Extension foundation

- WXT 0.20.27, React 19, TypeScript 6, Chromium Manifest V3.
- Entrypoints for the popup, ChatGPT content script, and background service worker.
- Strict TypeScript, ESLint, Vitest, and Happy DOM fixture tests.
- Generated build output is `output/chrome-mv3`; `output/` is gitignored.
- The intended workflow is personal installation from source, not browser-store distribution.

### Conversation collection

- Message boundary: `[data-message-author-role]` elements only.
- Roles collected: `user` and `assistant`.
- Messages are paired in DOM order into Exchanges.
- Collection records the active Conversation's scroll position, starts at the top, advances in bounded viewport-sized steps, and restores the original position in a `finally` path.
- Messages rendered at the original viewport are captured before scrolling so virtualization cannot discard a useful tail; the merged result is ordered by ChatGPT's conversation-turn index when available.
- Message identity and conversation order are resolved from independent nested ancestors, matching ChatGPT's live DOM rather than assuming both attributes share one element.
- If collection expands the scroll range, an original bottom position is restored to the new semantic bottom rather than its stale absolute pixel coordinate.
- Messages seen at overlapping scroll positions are deduplicated using ChatGPT turn/message identifiers when available and a content-plus-occurrence fallback otherwise.
- Collection stops after two stable passes at the bottom, a 30-second timeout, cancellation, failure, or a 200-pass safety limit.
- Correlated progress messages keep the requesting popup informed of the number of messages found and collection pass.
- Failed, timed-out, or non-stabilizing passes retain useful partial content and add a manual pre-scrolling warning.
- Unpaired or absent messages produce warnings rather than fabricated content.
- Hidden elements, buttons, scripts, styles, textareas, and copy controls are excluded.
- ChatGPT application chrome outside role-marked message containers is excluded.
- The Conversation title comes from `document.title` with the ChatGPT suffix removed.

### Markdown conversion

- User text in ChatGPT's `whitespace-pre-wrap` container preserves raw newlines.
- Assistant content prefers the `.markdown` subtree.
- Turndown plus the GFM plugin converts headings, paragraphs, emphasis, links, quotations, lists, strikethrough, task lists, and tables.
- Custom conversion rules preserve fenced code and language identifiers.
- KaTeX `application/x-tex` annotations become inline `$...$` or display `$$...$$` LaTeX.
- Remote images become ordinary links: `[Image: description](URL)`; they are not embedded or downloaded.
- Copy buttons and other controls are removed before conversion.

### Snapshot rendering

Current shape:

```md
---
title: "Conversation title"
source: "https://chatgpt.com/c/..."
exported: 2026-07-11 22:42:36
tags:
  - "chatgpt"
---

# Exchange 1 — first line of the query

> [!Question] first line of the query
>
> remaining query lines

Response text…

## Original response H1
```

- Each Exchange is one H1 section.
- The first query line is used as both the Exchange title and Question callout title.
- Every remaining query line is prefixed with `>`; blank lines become `>`.
- Response headings are lowered one level, except headings inside fenced code.
- H6 is clamped to H6.
- Response metadata is rendered only when available as `*timestamp · delay · model*`.
- Missing metadata is omitted rather than estimated.

## Architecture

Runtime flow implemented so far:

```text
Popup
  → tabs.sendMessage
ChatGPT content script
  → bounded automatic scroll pass + progress messages
  → role-marked DOM collection
  → HTML-to-Markdown conversion
  → ConversationDraft
Popup
  → snapshot renderer
  → editable Markdown textarea
```

Planned save boundary:

```text
Edited Markdown
  → clipboard
  → background service worker
  → obsidian://new?file=...&vault=...&silent=true&clipboard
  → Obsidian vault note
```

The content DOM is authoritative for the Visible Branch. Same-session ChatGPT data may later enrich model names and timestamps on a best-effort basis. Authentication cookies and tokens must never be exported or persisted.

## Important files

- `TASKS.md` — prioritized remaining work and acceptance criteria.
- `CONTEXT.md` — project glossary and canonical domain terms.
- `docs/adr/` — accepted architectural decisions.
- `docs/implementation-plan.md` — original plan and architecture outline; `TASKS.md` is now authoritative for execution order.
- `wxt.config.ts` — Manifest V3 metadata, permissions, host scope, and output directory.
- `entrypoints/chatgpt.content.ts` — request listener and content-script boundary.
- `entrypoints/popup/App.tsx` — popup state, active-tab messaging, and editable preview.
- `src/extraction/chatgpt-conversation.ts` — role discovery and Exchange pairing.
- `src/extraction/scroll-collector.ts` — bounded scrolling, convergence, deduplication, progress, and restoration orchestration.
- `src/markdown/html-to-markdown.ts` — DOM cleanup and Markdown conversion rules.
- `src/rendering/conversation-markdown.ts` — frontmatter, callouts, metadata, and heading nesting.
- `src/domain/` — draft, snapshot, Exchange, and profile types.
- `src/messaging/conversation.ts` — popup/content-script message contract.
- `src/**/__fixtures__` and `*.test.ts` — regression fixtures and tests.

## Architectural decisions

- `docs/adr/0001-write-vault-exports-through-obsidian-uri.md`: use clipboard-backed Obsidian URI rather than persistent filesystem permissions.
- `docs/adr/0002-use-visible-dom-with-best-effort-session-metadata.md`: visible DOM for content, optional same-session metadata enrichment, no authentication-data persistence.
- `docs/adr/0003-build-with-wxt-react-and-typescript.md`: WXT, React, TypeScript, and Manifest V3.

## Known limitations

- Automatic scrolling still needs live validation against long ChatGPT Conversations in Opera; selector or virtualization changes can still produce an incomplete snapshot, which is surfaced as a warning when the pass does not stabilize.
- Some especially long Conversations still time out because ChatGPT unloads lower message regions while scrolling upward; the timeout is currently 30 seconds, and deeper virtualization handling is deferred for focused investigation.
- Completeness detection does not yet recognize interrupted response generation beyond the existing unpaired-message warning.
- No response timestamps, query-to-response delay, or model enrichment yet.
- No persisted vault, folder, tags, or image settings.
- Note-title edits and Markdown edits are present only in the popup and are not saved.
- No Save button or Obsidian URI bridge.
- No local image downloading. Remote image links may require ChatGPT authentication and may expire.
- User-entered assembly and source examples that ChatGPT does not mark as code remain plain quoted text. Conservative code inference is deferred.
- DOM selectors are intentionally narrow but depend on ChatGPT's current markup. Live fixtures should be added whenever a selector changes.
- The export timestamp is currently formatted in UTC with a human-readable separator. Revisit only if local-time semantics are explicitly requested.
- The workspace was not a Git repository during the initial sessions; no commits or tags were created.

## Tooling notes

- Development environment used: Node.js 25.8.2 and npm 11.11.1 on macOS arm64.
- `npm install` once hit a transient esbuild post-install execution failure; retrying after verifying the cached arm64 binary succeeded.
- npm reports advisories in the dependency tree. A full audit was intentionally deferred at the user's request.
- `package-lock.json` is authoritative for exact dependency versions.

## Continue in a new session

1. Read `PROGRESS.md`, `TASKS.md`, `CONTEXT.md`, and the three ADRs.
2. Run `npm install` if `node_modules` is absent.
3. Run `npm run typecheck && npm run lint && npm test && npm run build`.
4. In Opera, load or reload `output/chrome-mv3` from `opera://extensions`.
5. Reload the ChatGPT tab after every content-script rebuild. Reloading only the extension is insufficient for an already-open page.
6. Start with the first unchecked task in `TASKS.md` and preserve fixture coverage for every DOM or formatting fix.
