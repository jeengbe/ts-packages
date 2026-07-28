import { defineConfig } from 'oxlint';

export const base = defineConfig({
  options: {
    typeAware: true,
    typeCheck: true,
    reportUnusedDisableDirectives: 'error',
  },
  plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'import', 'node', 'promise', 'vitest'],
  rules: {
    'typescript/consistent-type-imports': 'error',
    'typescript/no-explicit-any': 'warn',
    'import/no-nodejs-modules': 'off',
  },
  ignorePatterns: ['dist', 'coverage'],
  env: {
    es2026: true,
  },
});
