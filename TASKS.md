# Remaining Tasks

This file is the execution source of truth. Work top-to-bottom unless a newly discovered defect blocks the current task. Preserve the privacy boundary and add regression fixtures for every ChatGPT DOM or Markdown behavior change.

## P0 — Complete conversation collection

- [x] Add structured same-session Conversation collection with DOM scrolling fallback.

  Implemented behavior:

  - Read the Conversation ID from the current `/c/…` URL.
  - Obtain a short-lived access token from the active ChatGPT session and keep it only in memory.
  - Fetch the current Conversation graph and follow the `current_node` parent chain to reconstruct the Visible Branch.
  - Normalize text messages and available response metadata into the existing `ConversationDraft` model.
  - Fall back visibly to DOM scrolling after authentication, request, JSON, schema, graph, or empty-result failure.
  - Never log, persist, render, message between extension contexts, or export authentication material.

- [x] Implement automatic scrolling for long and virtualized Conversations.

  Acceptance criteria:

  - Record the user's original scroll position.
  - Scroll through the full conversation until no new role-marked messages appear or a bounded timeout/stability threshold is reached.
  - Deduplicate messages collected across scroll positions.
  - Restore the original scroll position even after failure or cancellation.
  - Keep the popup informed of collection progress.
  - If automation cannot complete, export collected content with a clear warning that manual pre-scrolling may be required.
  - Add unit tests for convergence, deduplication, timeout, and restoration behavior.

- [ ] Add completeness detection.

  Acceptance criteria:

  - Detect zero messages, unpaired queries/responses, interrupted generation, and a collection pass that did not stabilize.
  - Never silently label an incomplete snapshot as complete.
  - Keep best-effort export available when partial content is still useful.

## P0 — Best-effort response metadata

- [x] Investigate same-session ChatGPT conversation data without using an API key.
- [ ] Enrich each assistant response with response timestamp, query-to-response timestamp difference, and model name when available.

  Acceptance criteria:

  - Structured Conversation data is preferred; DOM content remains the fallback.
  - Metadata is matched to the correct visible Exchange.
  - Metadata failure never blocks content export.
  - Missing individual values are omitted.
  - No cookies, bearer tokens, session tokens, or authentication headers are logged, stored, rendered, or exported.
  - Add fixture tests for full, partial, missing, and mismatched metadata.

## P0 — Structured collection hardening

- [ ] Validate structured collection against ordinary, long, regenerated, edited-prompt, interrupted, tool-using, deep-research, citation-heavy, attachment, and generated-image Conversations.
- [ ] Add anonymized JSON fixtures for every supported ChatGPT content type and every live schema discrepancy.
- [ ] Define grouping rules for multiple backend nodes that form one visible user or assistant message.
- [ ] Make unsupported structured content trigger an explicit fidelity warning or DOM fallback rather than silent loss.
- [ ] Prevent concurrent duplicate structured requests and handle `429`/`Retry-After` without automatic retry loops.
- [ ] Decide whether to supersede ADR 0002 after structured content reaches parity with DOM fidelity.

  Acceptance criteria:

  - Only the ancestor path from `current_node` is exported; hidden alternative branches remain excluded.
  - Empty text components are ignored while non-empty components retain their order.
  - Authentication data exists only in local variables for the duration of collection.
  - One explicit export action performs at most one session request and one Conversation request.
  - Any structured failure leaves the best-effort DOM export available.

## P0 — Single export profile and popup

- [ ] Convert the popup fields to controlled state.
- [ ] Add editable vault, folder, default tags, note title, Markdown, and image-download toggle fields.
- [ ] Persist one Export Profile with extension-local storage.
- [ ] Add loading, collection progress, validation, export success, and actionable error states.

  Acceptance criteria:

  - Profile defaults survive browser restart and extension reload.
  - Per-export title, tags, and Markdown edits are used by the save action.
  - Editing the note title does not unexpectedly rewrite the Markdown frontmatter unless that behavior is deliberately implemented and tested.
  - The image-download setting defaults to off.
  - Popup behavior remains usable with large Markdown snapshots.

## P0 — Save to Obsidian

- [ ] Implement the clipboard helper with explicit success/failure reporting.
- [ ] Implement the background message that opens an `obsidian://new` URL.
- [ ] Build the vault-relative file path from configured folder plus sanitized Conversation title.
- [ ] Add the Save button and connect it to the edited Markdown.
- [ ] Provide URI `content` fallback when clipboard writing fails.

  Acceptance criteria:

  - Save creates a new note in the configured vault folder.
  - The note name comes from the editable Conversation title.
  - No overwrite, append, or merge flag is sent; Obsidian handles duplicate-name suffixing.
  - Silent mode is requested.
  - Clipboard and URI failures are visible in the popup.
  - Very long Conversations use the clipboard path rather than placing all Markdown in the URI.
  - Validate manually in Opera and Obsidian on macOS.

## P1 — Content fidelity hardening

- [ ] Validate live ChatGPT DOM for headings, nested lists, quotations, fenced code, tables, LaTeX, citations, links, deep-research content, and generated-image containers.
- [ ] Add anonymized HTML fixtures for every live discrepancy.
- [ ] Preserve code-language labels when ChatGPT places the language outside the `<code>` class.
- [ ] Improve citation handling where ChatGPT renders citations as interactive controls rather than ordinary anchors.
- [ ] Verify that response H6 clamping is acceptable in Obsidian Outline.
- [ ] Prevent filename/frontmatter issues with YAML-sensitive characters, slashes, control characters, and exceptionally long titles.

  Acceptance criteria:

  - No ChatGPT navigation, Share controls, feedback buttons, or copy buttons appear in Markdown.
  - Code, table, and LaTeX fixtures render correctly in Obsidian.
  - Response headings remain nested beneath their Exchange in Obsidian Outline.
  - Query callouts preserve every line, including blank lines and existing fenced code.

## P1 — Image behavior

- [ ] Keep remote images as ordinary links when image downloading is off.
- [ ] Determine whether authenticated ChatGPT image URLs remain usable from Obsidian.
- [ ] Spike a local-image transfer mechanism compatible with the clipboard-backed Obsidian URI boundary.

  Acceptance criteria:

  - Default exports never download image bytes.
  - Broken, `blob:`, and `data:` URLs do not create misleading remote links.
  - If local download cannot be implemented without a second integration mechanism, document the constraint before changing architecture.

## P1 — End-to-end validation

- [ ] Test short and long private Conversations in Opera.
- [ ] Test regenerated answers and edited prompts; export only the Visible Branch.
- [ ] Test Conversations with missing metadata and interrupted responses.
- [ ] Test duplicate Conversation-title exports and verify Obsidian suffix behavior.
- [ ] Test clipboard fallback and Obsidian-not-running errors.
- [ ] Add an automated browser smoke test if stable ChatGPT fixtures can cover the extension messaging path.
- [ ] Update `README.md` with final setup, permissions, usage, troubleshooting, and privacy guarantees.

## Deferred nice-to-have fidelity

- [ ] Infer unmarked code blocks in user queries when confidence is high.
- [ ] Recognize assembly listings, beginning with ARM64 instruction sequences, and wrap them in an appropriate fenced block.
- [ ] Recognize small source examples, beginning with C, without converting ordinary prose to code.
- [ ] Make inference conservative, reversible in the editable preview, and thoroughly fixture-tested.

## Explicitly out of scope for v1

- Batch export from the ChatGPT history sidebar.
- Hidden regenerated-response branches or the full Conversation tree.
- Automatic merging or overwriting of earlier Conversation Snapshots.
- Chrome Web Store or Opera Add-ons publication.
- Multiple named export profiles or templates.
- Support for the ChatGPT macOS app.
