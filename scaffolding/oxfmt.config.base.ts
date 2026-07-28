import { defineConfig } from 'oxfmt';

export const base = defineConfig({
  ignorePatterns: ['dist', 'coverage'],
  singleQuote: true,
  sortImports: {
    groups: [],
  },
});
