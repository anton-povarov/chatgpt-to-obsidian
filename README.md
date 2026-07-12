# ChatGPT to Obsidian

A local Chromium extension for exporting the current ChatGPT conversation as Markdown to an Obsidian vault.

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

## Load the unpacked extension

1. Run `npm run build`.
2. Open the browser's extension manager (`opera://extensions` or `chrome://extensions`).
3. Enable developer mode.
4. Choose **Load unpacked**.
5. Select `output/chrome-mv3` from this project.
6. Reload any already-open ChatGPT tab so the new content script is active.

Clicking the extension toolbar button opens a near-full-height editor inside the ChatGPT page. It extracts the Visible Branch and shows an editable, high-fidelity Markdown body preview. Click **Save to Obsidian** to generate frontmatter from the current title and tags, prepend it to the displayed body, and send the complete document to Obsidian. A blank Vault uses Obsidian's last active vault, and a blank Folder defaults to `ChatGPT`. The extension uses the clipboard-backed Obsidian URI flow, so the Obsidian desktop app must be installed and registered to handle `obsidian://` links.

## Design

- [Current progress](./PROGRESS.md)
- [Remaining tasks](./TASKS.md)
- [Implementation plan](./docs/implementation-plan.md)
- [Domain glossary](./CONTEXT.md)
- [Architecture decisions](./docs/adr)
