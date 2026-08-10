import type { CacheAdapter } from './interface.js';
import { VoidCacheAdapter } from './void.js';
import { describe, beforeEach, test, expect } from 'vitest';

describe('VoidCacheAdapter', () => {
  let adapter: CacheAdapter;

  beforeEach(() => {
    adapter = new VoidCacheAdapter();
  });

  test('mset does nothing', async () => {
    await adapter.mset([
      ['foo', 'bar', 1000],
      ['baz', 'qux', 2000],
    ]);

    expect(await adapter.mget(['foo'])).toEqual([undefined]);
  });

  test('mdel does nothing', async () => {
    await adapter.mdel(['foo']);

    expect(await adapter.mget(['foo'])).toEqual([undefined]);
  });

  test('pdel does nothing', async () => {
    await adapter.pdel('foo');

    expect(await adapter.mget(['foo'])).toEqual([undefined]);
  });

  test('mhas returns false', async () => {
    expect(await adapter.mhas(['foo'])).toEqual([false]);
  });

  test('getRemainingTtl returns undefined', async () => {
    expect(await adapter.getRemainingTtl('foo')).toBeUndefined();
  });
});
