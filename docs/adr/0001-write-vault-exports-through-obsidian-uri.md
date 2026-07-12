---
status: accepted
---

# Write Vault Exports through Obsidian URI

The extension will create a new Conversation Snapshot by placing rendered Markdown on the clipboard and invoking `obsidian://new` with the folder and filename, plus a vault parameter when explicitly configured. Omitting vault delegates to Obsidian's last active vault; an empty folder resolves to `ChatGPT`. Silent mode is intentionally omitted so Obsidian opens the newly created note in a focused tab, giving the user visible confirmation of the result. The extension will not request overwrite, append, or merge behavior; Obsidian may suffix duplicate filenames. This follows Obsidian Web Clipper's default cross-browser integration model and avoids depending on persistent File System Access permissions, at the cost of requiring the Obsidian desktop app and temporarily using the clipboard.
