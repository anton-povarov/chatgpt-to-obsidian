# V1 Tasks

This file is the execution source of truth for reaching a feature-complete v1. Work top-to-bottom unless a defect blocks the current task. Work not required for v1 lives in [`docs/backlog.md`](docs/backlog.md).

The structured same-session Conversation graph is the primary collection method. The existing visible-DOM scroll collector is a best-effort fallback and must not receive further hardening for v1 beyond fixes for regressions or release-blocking defects.

## P0 — Harden structured Conversation collection

- [ ] Make structured collection safe and predictable across supported Conversations.

  Required work:

  - Validate ordinary, long, regenerated, edited-prompt, interrupted, tool-using, deep-research, citation-heavy, attachment, and generated-image Conversations.
  - Add anonymized JSON fixtures for supported content types and every live schema discrepancy that affects collection.
  - Define and test grouping rules when multiple backend nodes form one visible user or assistant message.
  - Detect zero messages, unpaired messages, interrupted or actively generating responses, and structured results that may be incomplete.
  - Make unsupported structured content trigger an explicit fidelity warning or visible-DOM fallback rather than silent loss.
  - Add response-metadata fixtures for complete, partial, missing, and mismatched timestamps and model names.
  - Prevent concurrent duplicate collection requests from the popup.
  - Handle `429` and `Retry-After` without automatic retry loops; keep the fallback available.

  Acceptance criteria:

  - Only the ancestor path from `current_node` is exported; hidden alternative branches are excluded.
  - Supported content retains its order and is grouped into the correct visible Exchanges.
  - Incomplete or unsupported structured results are never silently presented as complete.
  - Metadata is matched to the correct Exchange, missing values are omitted, and metadata failure never blocks content export.
  - Authentication material exists only in local variables during collection and is never logged, persisted, rendered, messaged between extension contexts, or exported.
  - One explicit collection performs at most one session request and one Conversation request, with no automatic retries.
  - Any structured request, JSON, schema, graph, unsupported-content, or unusable-result failure leaves the existing best-effort visible-DOM export available.
  - Automated fixtures cover every supported structured shape used for the v1 release.

## P0 — Finish the popup and Export Profile

- [ ] Make every v1 popup field controlled, persistent where appropriate, and connected to export behavior.

  Required work:

  - Add controlled vault, folder, default tags, note title, and Markdown fields.
  - Persist one Export Profile containing vault, folder, and default tags in extension-local storage.
  - Use profile tags when rendering the initial Markdown snapshot.
  - Use the current note title and edited Markdown when saving; do not read stale initial values or ignored DOM defaults.
  - Add loading, collection progress, validation, saving, success, and actionable error states.
  - Keep the popup responsive and usable with large Markdown snapshots.

  Acceptance criteria:

  - Vault, folder, and default tags survive browser restart and extension reload.
  - The Save action uses the currently displayed vault, folder, note title, and Markdown.
  - Per-export edits do not silently mutate the saved Export Profile unless the user explicitly changes a profile field.
  - Editing the note title does not unexpectedly rewrite Markdown frontmatter.
  - Required fields are validated before saving and errors identify the field or action that needs attention.
  - The popup clearly distinguishes collection warnings from save failures.

## P0 — Save to Obsidian

- [ ] Create a new Conversation Snapshot through the clipboard-backed Obsidian URI flow in ADR 0001.

  Required work:

  - Implement a clipboard helper with explicit success and failure reporting.
  - Implement background messaging that opens an `obsidian://new` URI.
  - Build the vault-relative file path from the configured folder and sanitized note title.
  - Handle YAML-sensitive characters, path separators, control characters, blank titles, and exceptionally long filenames safely.
  - Add the Save button and connect it to the popup's current controlled values.
  - Use URI `content` only as a clipboard-failure fallback when the Markdown is short enough to be safe in a URI.
  - Surface clipboard, URI launch, validation, and Obsidian-not-running failures in the popup as far as browser APIs allow.

  Acceptance criteria:

  - Save creates a new note in the configured vault and folder using the editable note title.
  - The saved note contains the edited Markdown exactly as shown at the time of saving.
  - No overwrite, append, or merge flag is sent; Obsidian handles duplicate-name suffixing.
  - Silent mode is requested.
  - Long Conversations always use the clipboard path and are never placed in a URI query parameter.
  - Clipboard failure has a bounded URI-content fallback and never launches a truncated export.
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
