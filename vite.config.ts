import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 550 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
