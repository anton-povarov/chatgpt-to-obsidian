Chromium extension that exports the Current Conversation from `chatgpt.com` as a high-fidelity Markdown Conversation Snapshot.
Conversation collection is implemented with 2 methods - JSON API (primary) or Visible DOM scrolling (fallback, almost never needed).
Inspired by the Obsidian Web Clipper extension.

## Product
- Export the Current Conversation from the active `chatgpt.com` tab.
- Export only the Visible Branch; no history sidebar or batch export.
- Create an independent Conversation Snapshot on every export, named from the conversation title.
- Let the user edit title, tags and content + target vault and folder
- Send Markdown to a configured Obsidian vault and folder through the clipboard-backed `obsidian://new` flow.
- Run entirely locally. Never export or persist authentication cookies or tokens.


## Tech
Typescript, npm, eslint.
React, WXT, Chromium Manifest V3.

- Building `npm build`
- Check `npm run typecheck && npm run lint && npm test`

**Important paths**
CONTEXT.md - Definitions, read this to understand the terminology
output/chrome-mv3 - output for `npm build`, gitignored
docs/
	v1-artefacts/ - historical docs/adrs for the initial shipped version
	ADRs.md - merged list of all ADR-s currently in effect
	backlog.md - ideas for further development
	structured-conversation-collection.md - implementation details for the json api collection method
entrypoints/ - browser facing part of the extension
src/
	domain/ - domain model
	extraction/ - extracting domain data from json api or dom scrolling
	obsidian/ - interface to Obsidian
	...
