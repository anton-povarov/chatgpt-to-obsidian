---
status: accepted
---

# Prefer Structured Conversation Data with Visible-DOM Fallback

The extension will use ChatGPT's private same-session Conversation graph as the primary source for the Visible Branch, content, and available Response Metadata because it reconstructs long, virtualized Conversations more completely and quickly than page scrolling. Because that endpoint and its schema are undocumented, any structured collection failure falls back visibly to bounded visible-DOM scrolling; authentication material remains in memory only and is never logged, persisted, rendered, messaged between extension contexts, or exported. This supersedes the DOM-first source-authority decision in ADR-0002.
