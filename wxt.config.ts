import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'output',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'ChatGPT to Obsidian',
    description: 'Export the current ChatGPT conversation to an Obsidian vault.',
    permissions: ['activeTab', 'clipboardWrite', 'storage'],
    host_permissions: ['https://chatgpt.com/*'],
  },
});
