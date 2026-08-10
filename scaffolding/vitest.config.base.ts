import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export function base(rootDir: string) {
  return defineConfig({
    root: rootDir,
    test: {
      exclude: [...configDefaults.exclude, '**/dist/**'],
      reporters: 'verbose',
      passWithNoTests: true,
      setupFiles: [resolve(import.meta.dirname, 'vitest.setup.ts')],
      watch: false,
    },
  });
}
