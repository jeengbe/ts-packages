import 'node';
import '@total-typescript/ts-reset';
import type CustomMatchers from 'jest-extended';
import 'vitest';

declare module 'vitest' {
  interface Matchers<T = any> extends CustomMatchers<T> {}
}

declare module '@vitest/expect' {
  interface AsymmetricMatchersContaining extends CustomMatchers<any> {}
}
