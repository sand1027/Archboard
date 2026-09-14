import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    // `data` was missing, which is why the catalogues and templates had no tests — and why
    // four LLD templates could sit here for months silently rendering nothing.
    include: ['{lib,hooks,store,types,data}/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
