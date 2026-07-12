# Post-v1 Backlog

These ideas and hardening tasks are intentionally outside the feature-complete v1 path. Promote them into `TASKS.md` only when they become release-blocking or are deliberately selected for later work.

## Visible-DOM fallback hardening

- Validate live ChatGPT DOM for headings, nested lists, quotations, fenced code, tables, LaTeX, citations, links, deep-research content, and generated-image containers.
- Add anonymized HTML fixtures for live DOM discrepancies.
- Preserve code-language labels when ChatGPT places the language outside the `<code>` class.
- Improve citation handling where ChatGPT renders citations as interactive controls rather than ordinary anchors.
- Add an automated browser smoke test for the extension messaging path if stable ChatGPT fixtures can support it.

The visible-DOM scroll collector is good enough for v1. Do not harden its scrolling, convergence, or completeness behavior unless a regression or release-blocking defect is found.

## Markdown and Obsidian fidelity

- Verify that response H6 clamping is acceptable in Obsidian Outline.
- Expand live validation of code, tables, LaTeX, citations, links, deep-research output, and generated-image containers beyond what v1 requires.
- Add further filename and frontmatter hardening beyond the safety required by the v1 save flow.

## Image transfer

- Keep remote images as ordinary links when local image downloading is unavailable.
- Determine whether authenticated ChatGPT image URLs remain usable from Obsidian.
- Spike a local-image transfer mechanism compatible with the clipboard-backed Obsidian URI boundary.
- Add an image-download setting only when it controls implemented behavior; it should default to off.
- Ensure broken, `blob:`, and `data:` URLs do not create misleading remote links.
- Document the architectural constraint before adding a second integration mechanism for binary vault writes.

## Product validation and documentation

- Test clipboard and Obsidian error behavior across Chromium browsers beyond the v1 Opera/macOS target.
- Update `README.md` with polished setup, permissions, usage, troubleshooting, and privacy documentation.

## Optional query fidelity

- Infer unmarked code blocks in user queries when confidence is high.
- Recognize assembly listings, beginning with ARM64 instruction sequences, and wrap them in an appropriate fenced block.
- Recognize small source examples, beginning with C, without converting ordinary prose to code.
- Keep inference conservative, reversible in the editable preview, and thoroughly fixture-tested.

## Real-world structured Conversation fixtures

- Ask the developer for anonymized real-world message fixtures when expanding structured content support. ChatGPT's private Conversation response format is undocumented and may change.
- Use the popup's sensitive structured-JSON download to capture raw Conversation responses and per-node parse outcomes when a real discrepancy is observed.
- Add a checkbox to anonymise the data (remove conversation content, replacing it with "query N" and "response to query N")
- Sanitize personal content and metadata before committing any captured response as a fixture.
