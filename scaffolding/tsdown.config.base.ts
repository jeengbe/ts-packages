import { verifyPackageMeta } from './verify-package-meta.ts';
import type { RolldownChunk } from 'tsdown';
import { defineConfig } from 'tsdown';

export const base = defineConfig({
  entry: ['src/**/*', '!src/**/*.spec.ts', '!src/**/__snapshots__/**', '!src/**/fake.ts'],
  format: ['esm'],
  target: 'es2026',
  platform: 'node',
  publint: true,
  outputOptions: {
    sourcemap: true,
    minify: false, // Helps others when debugging an external package
  },
  unbundle: true, // Also helps for debugging
  deps: {
    // Throws if anything from node_modules ends up bundled instead of external.
    onlyBundle: [],
  },
  attw: {
    profile: 'esm-only',
  },
  hooks: {
    async 'build:done'({ options: { logger, root }, chunks }) {
      verifyNoFakeFiles(chunks);

      await verifyPackageMeta(
        logger,
        new URL(`file://${root.substring(0, root.length - 'src'.length)}`),
      );
    },
  },
});

function verifyNoFakeFiles(chunks: readonly RolldownChunk[]): void {
  const offenders = chunks
    .filter((chunk) => chunk.type === 'chunk')
    .flatMap((chunk) => chunk.moduleIds)
    .filter((id) => id.endsWith('/fake.ts'));

  if (offenders.length > 0) {
    throw new Error(
      `fake.ts files must not be part of the build output (they are test-only helpers):\n${offenders.join('\n')}`,
    );
  }
}
