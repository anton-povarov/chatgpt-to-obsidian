# V1 Tasks

Status: feature-complete and manually validated on 2026-07-13.

This file is the execution source of truth for reaching a feature-complete v1. Work top-to-bottom unless a defect blocks the current task. Work not required for v1 lives in [`docs/backlog.md`](docs/backlog.md).

The structured same-session Conversation graph is the primary collection method. The existing visible-DOM scroll collector is a best-effort fallback and must not receive further hardening for v1 beyond fixes for regressions or release-blocking defects.

## P0 — Harden structured Conversation collection

- [x] Make structured collection safe and predictable across supported Conversations.

  Required work:

  - Validate ordinary and long Conversations in Opera, plus selected-branch, interruption, partial-content, and unsupported-content behavior with automated graph fixtures. Best-effort handling is enough for tool-using, deep-research, citation-heavy, attachment, and generated-image Conversations.
  - Define and test grouping rules when multiple backend nodes form one visible user or assistant message.
  - Detect zero messages, unpaired messages, interrupted or actively generating responses, and structured results that may be incomplete.
  - Preserve recognized text from unsupported structured messages, omit unknown content, continue processing the branch, and show one informative partial-fidelity warning in the editor without adding warnings to exported Markdown.
  - Add response-metadata fixtures for complete, partial, missing, and mismatched timestamps and model names.
  - Prevent concurrent duplicate collection requests from the editor.
  - Handle `429` and `Retry-After` without automatic retry loops; keep the fallback available.
  - Keep the latest raw Conversation response in content-script memory and provide a sensitive JSON download containing per-node parse outcomes. Never capture the session response or access token.

  Acceptance criteria:

  - Only the ancestor path from `current_node` is exported; hidden alternative branches are excluded.
  - Supported content retains its order and is grouped into the correct visible Exchanges.
  - Incomplete or unsupported structured results are never silently presented as complete.
  - Metadata is matched to the correct Exchange, missing values are omitted, and metadata failure never blocks content export.
  - Authentication material exists only in local variables during collection and is never logged, persisted, rendered, messaged between extension contexts, or exported.
  - One explicit collection performs at most one session request and one Conversation request, with no automatic retries.
  - Unsupported message content produces a warned partial structured export; it does not trigger fallback by itself.
  - Structured request, JSON, top-level schema, graph, or unusable-result failure leaves the existing best-effort visible-DOM export available.
  - Automated fixtures cover the structured shapes known and supported for the v1 release. Capturing and anonymizing broader real-world fixtures is deferred to the backlog.

## P0 — Finish the embedded editor and Export Profile

- [x] Make every v1 editor field controlled, persistent where appropriate, and connected to export behavior.

  Required work:

  - Add controlled vault, folder, current tags, note title, and Markdown body fields.
  - Persist one Export Profile containing vault and folder in extension-local storage.
  - Initialize every current document with the hardcoded `chatgpt` tag; tag edits apply only to that Conversation Snapshot.
  - Keep the current note title, tags, and edited Markdown body in controlled per-export state ready for the save action; do not rely on stale initial values or ignored DOM defaults.
  - Add loading, collection progress, profile persistence status, and actionable collection or storage error states. Obsidian saving, success, and save-error states belong to the next task.
  - Keep the embedded editor responsive and usable with large Markdown snapshots.
  - Keep collection method above a compact single-line vault/folder/title/tags form and keep the structured-JSON control plus full-width Save action visible without scrolling the embedded frame.

  Acceptance criteria:

  - Vault and folder survive browser restart and extension reload; tags reset to `chatgpt` for each newly collected document.
  - Per-export edits do not silently mutate the saved Export Profile unless the user explicitly changes a profile field.
  - The preview contains only the editable Markdown body; frontmatter is generated from current fields when saving.
  - Profile storage failures are visible without preventing best-effort Conversation collection.
  - Profile normalization and storage behavior are covered without adding a browser-UI testing dependency.
  - The Markdown textarea owns content scrolling; the embedded frame does not scroll and the Save action remains immediately visible.

## P0 — Save to Obsidian

- [x] Create a new Conversation Snapshot through the clipboard-backed Obsidian URI flow in ADR 0001.

  Required work:

  - Implement a clipboard helper with explicit success and failure reporting.
  - Implement background messaging that opens an `obsidian://new` URI.
  - Build the vault-relative file path from the configured folder and sanitized note title.
  - Handle YAML-sensitive characters, path separators, control characters, blank titles, and exceptionally long filenames safely.
  - Add the Save button and connect it to the embedded editor's current controlled values.
  - Use URI `content` only as a clipboard-failure fallback when the Markdown is short enough to be safe in a URI.
  - Surface clipboard, URI launch, validation, and Obsidian-not-running failures in the editor as far as browser APIs allow.

  Acceptance criteria:

  - Save creates a new note using the editable note title; blank Vault uses Obsidian's last active vault and blank Folder uses `ChatGPT`.
  - The Save action uses the currently displayed vault, folder, note title, tags, and Markdown body rather than initial or stale values.
  - The saved note contains frontmatter generated from the current title and tags plus the edited Markdown body exactly as shown at the time of saving.
  - No overwrite, append, or merge flag is sent; Obsidian handles duplicate-name suffixing.
  - Obsidian opens and focuses the newly created note; silent mode is not requested.
  - Long Conversations always use the clipboard path and are never placed in a URI query parameter.
  - Clipboard failure has a bounded URI-content fallback and never launches a truncated export.
  - Required fields are validated before saving, errors identify the field or action requiring attention, and collection warnings remain distinct from save failures.
  - Duplicate titles, clipboard failure, invalid fields, and Obsidian-not-running behavior are tested.
  - The complete collection-to-save flow is manually validated in Opera and Obsidian on macOS with short and long private Conversations.
  - `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.

## Explicitly out of scope for v1

- Batch export from the ChatGPT history sidebar.
- Hidden regenerated-response branches or the full Conversation tree.
- Automatic merging or overwriting of earlier Conversation Snapshots.
- Chrome Web Store or Opera Add-ons publication.
- Multiple named export profiles or templates.
- Support for the ChatGPT macOS app.
