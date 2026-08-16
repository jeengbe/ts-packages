import { defineConfig } from 'oxfmt';

export const base = defineConfig({
  ignorePatterns: ['dist', 'coverage'],
  singleQuote: true,
  sortPackageJson: false, // Use 'pnpx sort-package-json **/package.json' instead
  sortImports: {
    groups: [],
    partitionByNewline: true,
    newlinesBetween: false,
  },
});
