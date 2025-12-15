import * as path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@edge-manifest/core': path.resolve(__dirname, './packages/@edge-manifest/core/src'),
      '@edge-manifest/cli': path.resolve(__dirname, './packages/@edge-manifest/cli/src'),
      '@edge-manifest/sdk': path.resolve(__dirname, './packages/@edge-manifest/sdk/src'),
      '@edge-manifest/admin-ui': path.resolve(__dirname, './packages/@edge-manifest/admin-ui/src'),
      '@edge-manifest/starter': path.resolve(__dirname, './packages/@edge-manifest/starter/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/**/src/**/*.ts'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.spec.ts'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
});
