import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['tmp/**', 'node_modules/**', 'output/**'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
