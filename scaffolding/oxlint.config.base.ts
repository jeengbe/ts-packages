import { defineConfig } from 'oxlint';

export const base = defineConfig({
  options: {
    typeAware: true,
    typeCheck: true,
    reportUnusedDisableDirectives: 'error',
  },
  settings: {
    vitest: {
      typecheck: true,
    },
  },
  plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'import', 'node', 'promise', 'vitest'],
  rules: {
    'typescript/adjacent-overload-signatures': 'error', // For code readability
    'oxc/approx-constant': 'error', // Convenient
    'typescript/array-type': ['error', { default: 'array', readonly: 'array' }], // Personal style
    'no-unused-vars': [
      'error',
      {
        fix: { imports: 'safe-fix' }, // Useful after modifying code
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    'typescript/ban-ts-comment': [
      'error',
      {
        'ts-expect-error': 'allow-with-description', // It can happens that types are wrong
        'ts-ignore': false, // And it should be easy to ignore whole files
      },
    ],
    'oxc/branches-sharing-code': 'error', // Convenient
    'promise/catch-or-return': ['error'], // Prevents uncaught promise rejections
    'unicorn/consistent-assert': 'error', // Consistent asserts.ok usage (more explicit)
    'unicorn/consistent-date-clone': 'error', // Convenient
    'unicorn/consistent-empty-array-spread': 'error', // Mixing array and string spread is seldom the desired behavior
    'unicorn/consistent-existence-index-check': 'error', // Uniformity
    'typescript/consistent-generic-constructors': 'error', // Uniformity
    'typescript/consistent-indexed-object-style': 'error', // Uniformity
    'unicorn/prefer-node-protocol': 'error', // Explicit node: prefix is recommended on platforms like Deno
  },
  overrides: [
    {
      files: ['*.spec.ts', '__utils__', '__utils__/**/*.ts'],
      rules: {
        'typescript/unbound-method': 'off', // It's common to use unbound methods in tests, e.g. `expect(obj.method).toHaveBeenCalled()`.
        'vitest/no-conditional-expect': 'off', // Useful for testing multiple properties of a thrown error
        'vitest/expect-expect': 'off', // For some methods, it's enough to check that they don't throw
        'unicorn/consistent-assert': 'off', // "assert" is fine for brevity
      },
    },
  ],
  ignorePatterns: ['dist', 'coverage'],
  env: {
    es2026: true,
  },
});
