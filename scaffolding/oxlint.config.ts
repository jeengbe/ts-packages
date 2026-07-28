import { base } from './oxlint.config.base.ts';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [base],
  overrides: [
    {
      files: ['types.d.ts'],
      rules: {
        'import/no-unassigned-import': 'off',
      },
    },
  ],
});
