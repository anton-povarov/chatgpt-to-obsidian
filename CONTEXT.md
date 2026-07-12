# ChatGPT to Obsidian

This context covers exporting ChatGPT conversations into a local Obsidian vault as durable Markdown notes.

## Language

**Vault Export**:
A Markdown conversation note written directly into a folder selected within the user's Obsidian vault.
_Avoid_: Download, file export

**Conversation**:
The chronological exchange of user prompts and ChatGPT responses displayed in one ChatGPT chat.
_Avoid_: Chat, thread

**Current Conversation**:
The Conversation open in the active ChatGPT browser tab and eligible for a Vault Export. V1 does not collect Conversations from sidebar history.
_Avoid_: Selected conversation, active chat

**Conversation Snapshot**:
An independent Vault Export of the Current Conversation at the moment of export, named from the Conversation title. Repeated exports create separately suffixed notes rather than merging or overwriting earlier snapshots.
_Avoid_: Synced note, canonical note

**Visible Branch**:
The sequence of queries and responses currently displayed in a Conversation. Hidden alternatives from edits or regenerated responses are not part of a Conversation Snapshot.
_Avoid_: Full conversation tree, response history

**Exchange**:
One user query paired with the ChatGPT response that follows it, represented as one top-level section whose title includes the query's first line.
_Avoid_: Turn, message pair

**Query Callout**:
The quoted Obsidian Question callout containing the user's complete query within an Exchange, with the query's first line used as the callout title.
_Avoid_: Query heading, prompt section

**Content Fidelity**:
The extent to which a Vault Export retains the visible semantic Markdown structure of a Conversation, including code, quotations, tables, lists, mathematics, and links.
_Avoid_: Screenshot, plain-text conversion

**Response Metadata**:
The response timestamp, elapsed time since the query timestamp, and model name recorded immediately before a ChatGPT response. Query timestamps are not exported separately.
_Avoid_: Message metadata, note metadata

**Linked Image**:
An image represented in a Vault Export by a link to its original web resource without copying the image into the vault.
_Avoid_: Downloaded image, embedded asset
