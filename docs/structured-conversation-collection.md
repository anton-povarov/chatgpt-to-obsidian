# Structured Conversation Collection

## Status

Implemented and manually validated in Opera for ordinary and long text Conversations. This is the preferred collection path. Automatic visible-DOM scrolling remains available as a fallback.

The approach uses ChatGPT's private, undocumented same-session endpoints. It does not use the official OpenAI developer API and requires no OpenAI API key.

## Motivation

Long ChatGPT Conversations are virtualized. Scrolling through the page can unload earlier or later message containers, change the scroll range, time out, or make DOM ordering depend on when nodes first render. The structured Conversation response already contains the complete node graph, branch relationships, timestamps, and message metadata, so it avoids rendering and scrolling as a completeness boundary.

In manual validation, structured collection exported a long Conversation completely and was much faster than the DOM collector.

## Runtime flow

```text
Current chatgpt.com/c/{conversation-id} page
  → GET /api/auth/session with ambient browser cookies
  → hold accessToken in a local variable
  → GET /backend-api/conversation/{conversation-id}
       Authorization: Bearer {accessToken}
  → validate JSON graph
  → walk current_node → parent → … → root
  → reverse path into chronological Visible Branch order
  → select visible user and assistant content
  → pair messages into Exchanges
  → attach available timestamp, delay, and model metadata
  → ConversationDraft

Any failure
  → visible warning
  → bounded DOM scroll collector
```

One explicit collection performs at most one session request and one Conversation request. There is no polling, sidebar-history collection, batch collection, or automatic retry loop.

## Authentication and privacy boundary

The Conversation endpoint rejected cookie-only requests with `conversation_inaccessible`, so the collector retrieves the active session object and uses its short-lived bearer token for the single Conversation request.

The access token:

- exists only in a local variable during collection;
- is never written to extension storage or the filesystem;
- is never logged or included in error messages;
- is never sent through extension runtime or tab messaging;
- is never rendered in the popup, Markdown, diagnostics, or exports.

The extension does not request browser cookie permissions. The session request relies on the already logged-in `chatgpt.com` browser session.

## Visible Branch reconstruction

The response contains a `mapping` of nodes and a `current_node` identifier. The mapping may include regenerated or edited alternatives that are not currently selected.

The collector starts at `current_node`, follows each node's `parent` link to the root, detects missing nodes and cycles, then reverses the path. It does not iterate through every mapping entry or export every child branch. This preserves the product boundary of exporting only the Visible Branch.

Nodes whose authors are not `user` or `assistant`, and nodes explicitly marked `is_visually_hidden_from_conversation`, are excluded.

## Content normalization

The structured parser currently accepts textual parts represented as:

```json
"plain string"
```

```json
{ "text": "text value" }
```

```json
{ "type": "text", "content": "text value" }
```

Empty text parts are ignored individually. Multiple non-empty parts retain their order and are separated by a blank line. A node containing only empty text is treated as empty rather than as an unsupported content type.

Consecutive assistant text nodes following one query are grouped into the same Exchange. Available assistant `create_time` and model metadata produce the response timestamp, query-to-response delay, and model label.

## Validation and fallback

Structured collection falls back to DOM scrolling after:

- a page URL without a Conversation ID;
- session or Conversation request failure;
- a missing access token;
- non-JSON responses;
- an unsupported top-level graph shape;
- a missing node or parent cycle;
- a graph containing no complete Exchanges.

The popup displays the selected method:

- `ChatGPT structured conversation data`; or
- `visible DOM scrolling`.

Fallback errors are sanitized. Response bodies and authentication data are not surfaced.

## Rate-limit posture

No rate limit has been observed yet. The collector minimizes request volume by remaining entirely user-triggered and making only two reads per export: one session request and one current-Conversation request. It does not automatically retry a `429`; the existing behavior falls back to DOM and exposes the HTTP status in the warning.

Future hardening should prevent concurrent duplicate structured requests and may honor `Retry-After` before another structured attempt.

## Known gaps

- Validate regenerated responses and edited prompts against `current_node` selection.
- Validate interrupted or actively generating responses.
- Add fixtures for tool calls, deep research, citations, attachments, generated images, and every observed `content_type`.
- Determine when multiple backend nodes represent one visible logical message and formalize grouping rules.
- Ensure unsupported structured content cannot be silently omitted; warn or use DOM fallback.

## Relevant files

- `entrypoints/chatgpt.content.ts` — structured-first orchestration and DOM fallback.
- `src/extraction/chatgpt-structured-conversation.ts` — authentication, fetch, graph traversal, validation, normalization, and metadata.
- `src/extraction/chatgpt-structured-conversation.test.ts` — branch, cycle, authentication, metadata, and text-part fixtures.
- `src/extraction/chatgpt-conversation.ts` — DOM collector adapter.
- `src/extraction/scroll-collector.ts` — bounded fallback scrolling.
- `src/domain/conversation-draft.ts` — collection method and normalized draft boundary.
