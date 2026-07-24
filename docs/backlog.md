## [P0] Markdown and Obsidian fidelity

- Infer unmarked code blocks in user queries when confidence is high
  - Target C/C++, Go, Rust, Assembly (x86/arm64) - but don't be shy to support more
  - Keep inference conservative, reversible in the editable preview, and thoroughly fixture-tested.
- Expand live validation of code, tables, LaTeX, citations, links, deep-research output, and generated-image containers.

## [P0] Compatibility

- Test clipboard and Obsidian error behavior across Chromium browsers beyond the v1 Opera/macOS target.

## [P1] Image downloading

- Keep remote images as ordinary links when local image downloading is unavailable.
- Determine whether authenticated ChatGPT image URLs remain usable from Obsidian.
- Spike a local-image transfer mechanism compatible with the clipboard-backed Obsidian URI boundary.
- Ensure broken, `blob:`, and `data:` URLs do not create misleading remote links.

## [P1] Harden support for the undocumented structured JSON API

- Ask the developer for anonymized real-world message fixtures when expanding structured content support. ChatGPT's private Conversation response format is undocumented and may change.
- Sanitize personal content and metadata before committing any captured response as a fixture.
  - Add a checkbox to the "debug json download" feature to anonymize the data

## [P3] Visible-DOM fallback hardening

- Validate live ChatGPT DOM for headings, nested lists, quotations, fenced code, tables, LaTeX, citations, links, deep-research content, and generated-image containers.
- Add anonymized HTML fixtures for live DOM discrepancies.
- Preserve code-language labels when ChatGPT places the language outside the `<code>` class.
- Improve citation handling where ChatGPT renders citations as interactive controls rather than ordinary anchors.
- Add an automated browser smoke test for the extension messaging path if stable ChatGPT fixtures can support it.

