---
status: superseded by ADR-0004
---

# Use Visible DOM with Best-Effort Session Metadata

The Visible Branch and its rendered content were originally extracted from ChatGPT's conversation message containers in the page DOM, excluding surrounding application chrome. Same-session ChatGPT conversation data was limited to best-effort metadata enrichment. ADR-0004 supersedes this source-authority decision by making structured Conversation data primary and retaining visible-DOM scrolling as the fallback; the authentication privacy boundary remains unchanged.
