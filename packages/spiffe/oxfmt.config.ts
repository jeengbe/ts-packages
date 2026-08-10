import { base } from '@jeengbe/scaffolding/oxfmt.config.base.ts';
import { defineConfig } from 'oxfmt';

export default defineConfig({
  ...base,
  ignorePatterns: [...base.ignorePatterns, 'src/proto/**/*.ts'],
});
