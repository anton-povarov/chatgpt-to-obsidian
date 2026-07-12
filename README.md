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

The current popup extracts the visible ChatGPT conversation and shows an editable, high-fidelity Markdown preview. Saving to Obsidian is not implemented yet; see `TASKS.md` for the remaining work.

## Design

- [Current progress](./PROGRESS.md)
- [Remaining tasks](./TASKS.md)
- [Implementation plan](./docs/implementation-plan.md)
- [Domain glossary](./CONTEXT.md)
- [Architecture decisions](./docs/adr)
