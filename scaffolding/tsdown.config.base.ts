import { verifyPackageMeta } from './verify-package-meta.ts';
import { defineConfig } from 'tsdown';

export const base = defineConfig({
  entry: ['src/**/*', '!src/**/*.spec.ts', '!src/**/__snapshots__/**'],
  format: ['esm'],
  target: 'es2026',
  platform: 'node',
  publint: true,
  treeshake: false,
  outputOptions: {
    sourcemap: true,
    minify: false,
  },
  inputOptions: {
    optimization: {
      inlineConst: false,
    },
  },
  unbundle: true,
  deps: {
    // Throws if anything from node_modules ends up bundled instead of external.
    onlyBundle: [],
  },
  attw: {
    profile: 'esm-only',
  },
  hooks: {
    async 'build:done'({ options: { logger, root } }) {
      verifyPackageMeta(logger, new URL(`file://${root}`));
    },
  },
});
