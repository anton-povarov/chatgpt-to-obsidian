---
status: accepted
---

# Write Vault Exports through Obsidian URI

The extension will create a new Conversation Snapshot by placing rendered Markdown on the clipboard and invoking `obsidian://new` with the configured vault, folder, filename, and silent mode. It will not request overwrite, append, or merge behavior; Obsidian may suffix duplicate filenames. This follows Obsidian Web Clipper's cross-browser integration model and avoids depending on persistent File System Access permissions, at the cost of requiring the Obsidian desktop app and temporarily using the clipboard.
