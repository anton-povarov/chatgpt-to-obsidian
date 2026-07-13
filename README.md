# ChatGPT to Obsidian

A local Chromium extension for exporting the current ChatGPT conversation as Markdown to an Obsidian vault.

## Installation

1. Run `npm install && npm run build`.
2. Open the browser's extension manager (`chrome://extensions` or `opera://extensions` etc.).
3. Enable developer mode.
4. Choose **Load unpacked**.
5. Select `output/chrome-mv3` from this project.
6. Reload any already-open ChatGPT tab so the new content script is active.

## Usage

1. Open a conversation on [chatgpt.com](https://chatgpt.com) and click the extension toolbar button.
2. Review or edit the Markdown preview, title, tags, vault, and folder.
3. Click **Save to Obsidian**.

Each save creates a new snapshot. Leave Vault blank to use Obsidian's last active vault, or Folder blank to save to `ChatGPT`. Obsidian must be already installed.

## Development

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

Quality checks:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```
