# ChatGPT to Obsidian

A local Chromium extension for exporting the current ChatGPT conversation as Markdown to an Obsidian vault.

## Installation from a release

1. Download `chatgpt-to-obsidian-<version>-chrome.zip` from the
   [latest GitHub Release](https://github.com/anton-povarov/chatgpt-to-obsidian/releases/latest).
2. Extract the ZIP to a local folder (and keep it around forever).
3. Open the browser's extension manager (`chrome://extensions`, `opera://extensions`, etc.).
4. Enable developer mode.
5. Choose **Load unpacked** and select the extracted folder.
6. Reload any already-open ChatGPT tab so the new content script is active.

## Usage

1. Open a conversation on [chatgpt.com](https://chatgpt.com) and click the extension toolbar button.
2. Review or edit the Markdown preview, title, tags, vault, and folder.
3. Click **Save to Obsidian**.

Each save creates a new snapshot. Leave Vault blank to use Obsidian's last active vault, or Folder blank to save to `ChatGPT`. Obsidian must be already installed.

## Development

Requirements: Node.js 24 and npm.

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

Build an installable ZIP locally:

```sh
npm run zip
```

The result is `output/chatgpt-to-obsidian-<version>-chrome.zip`.

### Automated builds and releases

GitHub Actions runs the quality checks and builds the packed extension for every
pull request, push to `main`, and manual workflow run. For pushes to `main` and
manual runs, the resulting ZIP is available from that workflow run for 30 days.

Pushing a version tag publishes the same ZIP as a permanent GitHub Release asset.
The tag must be `v` followed by the exact version in `package.json`. For example:

```sh
npm version patch
git push origin main --follow-tags
```
