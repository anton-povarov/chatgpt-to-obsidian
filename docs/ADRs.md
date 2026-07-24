# [0001] Write Vault Exports through Obsidian URI

The extension will create a new Conversation Snapshot by placing rendered Markdown on the clipboard and invoking `obsidian://new` with the folder and filename, plus a vault parameter when explicitly configured. Omitting vault delegates to Obsidian's last active vault; an empty folder resolves to `ChatGPT`. Silent mode is intentionally omitted so Obsidian opens the newly created note in a focused tab, giving the user visible confirmation of the result. The extension will not request overwrite, append, or merge behavior; Obsidian may suffix duplicate filenames. This follows Obsidian Web Clipper's default cross-browser integration model and avoids depending on persistent File System Access permissions, at the cost of requiring the Obsidian desktop app and temporarily using the clipboard.

# [0004] Prefer Structured Conversation Data with Visible-DOM Fallback

The extension will use ChatGPT's private same-session Conversation graph as the primary source for the Visible Branch, content, and available Response Metadata because it reconstructs long, virtualized Conversations more completely and quickly than page scrolling. Because that endpoint and its schema are undocumented, any structured collection failure falls back visibly to bounded visible-DOM scrolling; authentication material remains in memory only and is never logged, persisted, rendered, messaged between extension contexts, or exported. See `structured-conversation-collection.md` for implementation details.

# [0005] Open the Editor UI as an Embedded Page Iframe

The toolbar action will toggle a fixed, near-full-height extension iframe inside the active ChatGPT page, following Obsidian Web Clipper's Embedded behavior, rather than opening a Chromium action popup. This bypasses the action popup's hard 600-pixel height limit while keeping extension UI and page styles isolated; it requires exposing the built editor page only to `chatgpt.com` and coordinating open and close actions through the content script.

# [0006] Publish Packed Extensions through GitHub Actions

The repository will use GitHub Actions to run the TypeScript, lint, and test checks before producing WXT's unsigned Chromium Manifest V3 ZIP. Pull requests will verify that the ZIP builds without retaining it; pushes to `main` and manual runs will retain it as a directly downloadable workflow artifact for 30 days. A pushed `v<version>` tag must exactly match the version in `package.json`; after the same checks pass, the workflow will retain the ZIP and publish it as a permanent GitHub Release asset. Users must extract the ZIP and load its folder through Chromium's developer-mode **Load unpacked** flow because the package is not browser-store-signed.
