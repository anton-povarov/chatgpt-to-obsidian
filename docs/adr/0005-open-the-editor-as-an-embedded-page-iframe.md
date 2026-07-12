---
status: accepted
---

# Open the Editor as an Embedded Page Iframe

The toolbar action will toggle a fixed, near-full-height extension iframe inside the active ChatGPT page, following Obsidian Web Clipper's Embedded behavior, rather than opening a Chromium action popup. This bypasses the action popup's hard 600-pixel height limit while keeping extension UI and page styles isolated; it requires exposing the built editor page only to `chatgpt.com` and coordinating open and close actions through the content script.
