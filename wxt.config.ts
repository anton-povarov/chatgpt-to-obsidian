import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'output',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    build: {
      // Chromium can reject extension module preloads with a cross-world mismatch.
      modulePreload: false,
    },
  }),
  manifest: {
    name: 'ChatGPT to Obsidian',
    description: 'Export the current ChatGPT conversation to an Obsidian vault.',
    minimum_chrome_version: '127',
    action: {
      default_title: 'ChatGPT to Obsidian',
    },
    permissions: ['activeTab', 'clipboardWrite', 'storage'],
    host_permissions: ['https://chatgpt.com/*'],
    web_accessible_resources: [
      {
        resources: ['editor.html', 'chunks/*', 'assets/*'],
        matches: ['https://chatgpt.com/*'],
      },
    ],
  },
});
