# Project Progress

Last updated: 2026-07-12 (Asia/Dubai)

## Objective

Build a personal, unpacked Chromium extension that exports the Current Conversation from `chatgpt.com` as a high-fidelity Markdown Conversation Snapshot in a predefined Obsidian vault folder. Opera is the primary browser. No OpenAI API key is required.

## Current state

The extension builds, loads in Opera, opens its editor as a near-full-height iframe overlay in the active ChatGPT tab, collects the Visible Branch from ChatGPT's structured same-session Conversation graph, falls back to automatic DOM scrolling when necessary, converts the result to Markdown, and presents an editable Markdown preview. It does not yet save to Obsidian.

Verified manually in Opera:

- `output/chrome-mv3` loads as an unpacked extension.
- The toolbar action opens and closes a near-full-height embedded editor on a private ChatGPT Conversation.
- The embedded editor follows the ChatGPT viewport height, scrolls internally, and is no longer constrained by Chromium's action-popup height limit.
- Editor-to-content-script messaging works through Chromium's `sendResponse` callback.
- Conversation content is extracted without the sidebar or surrounding ChatGPT controls.
- Queries render as Obsidian Query callouts.
- Multiline user queries retain their line breaks.
- Exchange headings use only the first query line.
- The human-readable export timestamp renders as `YYYY-MM-DD HH:mm:ss` in UTC.
- Authenticated structured collection succeeds without an OpenAI API key and is much faster than DOM scrolling.
- A long Conversation previously affected by DOM virtualization exports completely through structured collection.
- The embedded editor identifies whether structured data or DOM scrolling produced the result.

Verified automatically:

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm test` passes: 43 tests across 9 files.
- `npm run build` passes and produces `output/chrome-mv3`.

## Implemented behavior

### Extension foundation

- WXT 0.20.27, React 19, TypeScript 6, Chromium Manifest V3.
- Entrypoints for the React editor page, ChatGPT content script, and background service worker.
- Strict TypeScript, ESLint, Vitest, and Happy DOM fixture tests.
- Generated build output is `output/chrome-mv3`; `output/` is gitignored.
- The intended workflow is personal installation from source, not browser-store distribution.

### Embedded editor and Export Profile

- The toolbar action toggles a fixed editor iframe inside the ChatGPT page at `calc(100vh - 24px)`, avoiding Chromium's 600-pixel action-popup cap.
- The embedded editor is isolated from page styles, exposes its extension resources only on `chatgpt.com`, and closes from its header button or the Escape key.
- Vault, folder, and comma-separated default tags are controlled editor fields.
- One Export Profile is normalized and persisted in extension-local storage; rapid edits are serialized so the newest value is stored last.
- Persisted tags load before collection and determine the initial Markdown frontmatter. Later default-tag edits apply to future snapshots and never overwrite current Markdown edits.
- Note title and Markdown are controlled per-export values and do not mutate profile defaults.
- Profile loading or saving failures are shown separately from Conversation collection warnings.
- The structured diagnostic JSON download remains available from the ready editor.

### Conversation collection

- Collection first requests the active ChatGPT session, holds its short-lived access token only in a local variable, and uses it for one read-only request for the Conversation ID in the current `/c/…` URL. Cookies, tokens, and authentication headers are never logged, persisted, messaged between extension contexts, rendered, or exported.
- Structured Conversation graphs are validated, and only the ancestor path from `current_node` is normalized so hidden alternative branches are excluded.
- Structured user and assistant text is paired into Exchanges with timestamps, query-to-response delay, and model metadata when present.
- Consecutive assistant nodes are grouped into one Exchange in branch order; the final assistant node supplies response metadata.
- Unsupported structured fragments no longer cause fallback or silent loss: recognized text is retained, unknown content is omitted, and one combined, diagnostic-oriented warning appears in the editor without modifying generated Markdown.
- Unsupported messages with no recognized text are skipped with an explicit warning while later branch messages continue processing.
- Known non-visible `model_editable_context` nodes are ignored without fidelity warnings and remain identified in diagnostic JSON.
- Explicit in-progress structured messages and unpaired messages produce editor warnings without modifying generated Markdown.
- Concurrent editor requests share one in-flight collection, preventing duplicate session and Conversation requests.
- `429` responses are not retried automatically; sanitized `Retry-After` guidance is reported before DOM fallback.
- The latest raw Conversation response is buffered in content-script memory without the session response or access token. The editor can download it as sensitive JSON with per-node parse outcomes and reasons.
- Any request, JSON, schema, graph, or empty-result failure visibly falls back to the DOM scroll collector.
- Message boundary: `[data-message-author-role]` elements only.
- Roles collected: `user` and `assistant`.
- Messages are paired in DOM order into Exchanges.
- Collection records the active Conversation's scroll position, starts at the top, advances in bounded viewport-sized steps, and restores the original position in a `finally` path.
- Messages rendered at the original viewport are captured before scrolling so virtualization cannot discard a useful tail; the merged result is ordered by ChatGPT's conversation-turn index when available.
- Message identity and conversation order are resolved from independent nested ancestors, matching ChatGPT's live DOM rather than assuming both attributes share one element.
- If collection expands the scroll range, an original bottom position is restored to the new semantic bottom rather than its stale absolute pixel coordinate.
- Messages seen at overlapping scroll positions are deduplicated using ChatGPT turn/message identifiers when available and a content-plus-occurrence fallback otherwise.
- Collection stops after two stable passes at the bottom, a 30-second timeout, cancellation, failure, or a 200-pass safety limit.
- Correlated progress messages keep the requesting editor informed of the number of messages found and collection pass.
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

> [!Query] 
> lines of the query

Response text…

## Original response H1
```

- Each Exchange is one H1 section.
- The first query line is used as the Exchange title.
- Query is formatted as markdown callout with header "Query", query lines are prefixed with `>`; blank lines become `>`.
- Response headings are lowered one level, except headings inside fenced code.
- H6 is clamped to H6.
- Response metadata is rendered only when available as `*timestamp · delay · model*`.
- Missing metadata is omitted rather than estimated.

## Architecture

Runtime flow implemented so far:

```text
Toolbar action
  → background clears action popup and sends toggle message
ChatGPT content script
  → fixed near-full-height iframe (`popup.html?context=embedded`)
Embedded editor
  → tabs.sendMessage
ChatGPT content script
  ├─ active-session access token (memory only)
  │    → current Conversation graph
  │    → current_node ancestor path
  │    → structured text + response metadata normalization
  └─ on failure: bounded DOM scroll pass + progress messages
       → role-marked DOM collection
       → HTML-to-Markdown conversion
  → ConversationDraft
Embedded editor
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

Structured same-session Conversation data is the preferred source for the Visible Branch and response metadata. The DOM collector remains the best-effort fallback because the private endpoint and schema are undocumented and rich content types are not yet fully normalized. Authentication cookies and tokens must never be logged, persisted, messaged between extension contexts, rendered, or exported.

## Important files

- `TASKS.md` — prioritized remaining work and acceptance criteria.
- `CONTEXT.md` — project glossary and canonical domain terms.
- `docs/adr/` — architectural decision records, including superseded decisions retained as history.
- `docs/implementation-plan.md` — historical product boundary and build order; it is not authoritative for current status or execution order.
- `docs/structured-conversation-collection.md` — current structured-data approach, authentication boundary, graph traversal, fallback behavior, and open questions.
- `wxt.config.ts` — Manifest V3 metadata, permissions, host scope, and output directory.
- `entrypoints/background.ts` — toolbar-action routing for the embedded editor and future Obsidian URI bridge.
- `entrypoints/chatgpt.content.ts` — collection request boundary and embedded-editor toggle.
- `entrypoints/popup/App.tsx` — embedded editor state, active-tab messaging, profile fields, diagnostics, and editable preview.
- `src/embedded/embedded-popup.ts` — fixed viewport-height iframe creation and toggle behavior.
- `src/storage/export-profile-storage.ts` — normalized extension-local Export Profile persistence.
- `src/extraction/chatgpt-conversation.ts` — role discovery and Exchange pairing.
- `src/extraction/chatgpt-structured-conversation.ts` — same-session graph fetch, Visible Branch traversal, validation, normalization, diagnostics, and metadata.
- `src/extraction/scroll-collector.ts` — bounded scrolling, convergence, deduplication, progress, and restoration orchestration.
- `src/markdown/html-to-markdown.ts` — DOM cleanup and Markdown conversion rules.
- `src/rendering/conversation-markdown.ts` — frontmatter, callouts, metadata, and heading nesting.
- `src/domain/` — draft, snapshot, Exchange, and profile types.
- `src/messaging/conversation.ts` — editor/content-script message contract.
- `src/**/__fixtures__` and `*.test.ts` — regression fixtures and tests.

## Architectural decisions

- `docs/adr/0001-write-vault-exports-through-obsidian-uri.md`: use clipboard-backed Obsidian URI rather than persistent filesystem permissions.
- `docs/adr/0002-use-visible-dom-with-best-effort-session-metadata.md`: superseded DOM-first source-authority decision, retained as decision history.
- `docs/adr/0003-build-with-wxt-react-and-typescript.md`: WXT, React, TypeScript, and Manifest V3.
- `docs/adr/0004-prefer-structured-conversation-data-with-visible-dom-fallback.md`: use structured same-session Conversation data first and bounded visible-DOM scrolling on failure.
- `docs/adr/0005-open-the-editor-as-an-embedded-page-iframe.md`: open the editor in a near-full-height iframe inside the ChatGPT page rather than a height-capped action popup.

## Known limitations

- Structured collection uses private, undocumented ChatGPT endpoints and schemas that may change without notice.
- Structured collection is validated for ordinary and long text Conversations, but not yet for tool, research, citation, attachment, image, regenerated, edited-prompt, or in-progress response payloads.
- The DOM fallback remains vulnerable to ChatGPT virtualization. Some especially long Conversations time out because lower message regions unload while scrolling upward; its timeout is currently 30 seconds.
- Structured requests may eventually encounter rate limiting. The extension performs at most one session request and one Conversation request per in-flight collection, shares that collection across concurrent editor requests, does not retry automatically, reports sanitized `Retry-After` guidance, and falls back to DOM on request failure.
- Interrupted-generation detection is conservative and recognizes only explicit `in_progress`, `streaming`, or `is_complete: false` signals plus unpaired messages; other private-schema signals may be missed.
- Response timestamps, query-to-response delay, and model enrichment are available from structured messages when those fields are present; broader fixture and live coverage remains open.
- Vault, folder, and default tags are persisted; note-title and Markdown edits remain per-export and are not yet saved to Obsidian.
- No Save button or Obsidian URI bridge.
- No local image downloading. Remote image links may require ChatGPT authentication and may expire.
- User-entered assembly and source examples that ChatGPT does not mark as code remain plain quoted text. Conservative code inference is deferred.
- DOM selectors are intentionally narrow but depend on ChatGPT's current markup. Live fixtures should be added whenever a selector changes.

## Tooling notes

- Development environment used: Node.js 25.8.2 and npm 11.11.1 on macOS arm64.
- npm reports advisories in the dependency tree. A full audit was intentionally deferred at the user's request.
- `package-lock.json` is authoritative for exact dependency versions.

## Continue in a new session

1. Read `PROGRESS.md`, `TASKS.md`, `CONTEXT.md`, `docs/structured-conversation-collection.md`, and the five ADRs.
2. Run `npm install` if `node_modules` is absent.
3. Run `npm run typecheck && npm run lint && npm test && npm run build`.
4. In Opera, load or reload `output/chrome-mv3` from `opera://extensions`.
5. Reload the ChatGPT tab after every content-script rebuild. Reloading only the extension is insufficient for an already-open page.
6. Start with **P0 — Save to Obsidian** in `TASKS.md`. Reassess its acceptance criteria before implementation; avoid adding complexity for failures Chromium cannot reliably observe.
