import type { CacheComputeResult } from './cache.js';
import { SpiffeCacheImpl } from './cache.js';
import { setTimeout } from 'node:timers/promises';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

describe('SpiffeCacheImpl', () => {
  let cache: SpiffeCacheImpl<string>;

  beforeEach(() => {
    cache = new SpiffeCacheImpl({});

    return () => {
      cache.close();
    };
  });

  it('should return the computed value', async () => {
    expect(await cache.getOrCompute(['a'], async () => ['value', 1000])).toBe('value');
  });

  it('should pass a signal to compute', async () => {
    const compute = vitest.fn<Compute>(async () => ['value', 1000]);

    await cache.getOrCompute(['a'], compute);

    expect(compute).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('should cache the computed value', async () => {
    const compute = vitest.fn<Compute>(async () => ['value', 1000]);

    await cache.getOrCompute(['a'], compute);
    expect(await cache.getOrCompute(['a'], compute)).toBe('value');

    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('should cache per key', async () => {
    const compute = vitest.fn<Compute>(async () => ['value', 1000]);

    await cache.getOrCompute(['a'], compute);
    await cache.getOrCompute(['b'], compute);
    await cache.getOrCompute(['a', 'b'], compute);

    expect(compute).toHaveBeenCalledTimes(3);
  });

  it('should not confuse keys that join to the same string', async () => {
    const compute = vitest.fn<Compute>(async () => ['value', 1000]);

    await cache.getOrCompute(['a,b'], compute);
    await cache.getOrCompute(['a', 'b'], compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('should expire entries after their TTL', async () => {
    const compute = vitest.fn<Compute>(async () => ['value', 50]);

    await cache.getOrCompute(['a'], compute);
    await setTimeout(100);
    await cache.getOrCompute(['a'], compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('should cap the TTL at maxTtlMs', async () => {
    cache = new SpiffeCacheImpl({ maxTtlMs: 50 });
    const compute = vitest.fn<Compute>(async () => ['value', 60_000]);

    await cache.getOrCompute(['a'], compute);
    await setTimeout(100);
    await cache.getOrCompute(['a'], compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('should evict entries beyond maxEntries', async () => {
    cache = new SpiffeCacheImpl({ maxEntries: 2 });
    const compute = vitest.fn<Compute>(async () => ['value', 60_000]);

    await cache.getOrCompute(['a'], compute);
    await cache.getOrCompute(['b'], compute);
    await cache.getOrCompute(['c'], compute);
    expect(compute).toHaveBeenCalledTimes(3);

    await cache.getOrCompute(['b'], compute);
    await cache.getOrCompute(['c'], compute);
    expect(compute).toHaveBeenCalledTimes(3);

    await cache.getOrCompute(['a'], compute);
    expect(compute).toHaveBeenCalledTimes(4);
  });

  it.each([0, -1])('should not cache values with a TTL of %d', async (ttlMs) => {
    const compute = vitest.fn<Compute>(async () => ['value', ttlMs]);

    expect(await cache.getOrCompute(['a'], compute)).toBe('value');
    expect(await cache.getOrCompute(['a'], compute)).toBe('value');

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('should return null and not cache a null result', async () => {
    const compute = vitest.fn<Compute>(async () => null);

    expect(await cache.getOrCompute(['a'], compute)).toBeNull();
    expect(await cache.getOrCompute(['a'], compute)).toBeNull();

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('should not cache errors', async () => {
    const compute = vitest
      .fn<Compute>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(['value', 1000]);

    await expect(cache.getOrCompute(['a'], compute)).rejects.toThrow('boom');
    expect(await cache.getOrCompute(['a'], compute)).toBe('value');

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('should propagate a synchronous throw in compute as a rejection', async () => {
    const compute = vitest
      .fn<Compute>()
      .mockImplementationOnce(() => {
        throw new Error('boom');
      })
      .mockResolvedValueOnce(['value', 1000]);

    await expect(cache.getOrCompute(['a'], compute)).rejects.toThrow('boom');
    expect(await cache.getOrCompute(['a'], compute)).toBe('value');
  });

  describe('deduplication', () => {
    it('should share a single computation between concurrent callers', async () => {
      const { promise, resolve } = Promise.withResolvers<[string, number]>();
      const compute = vitest.fn<Compute>(() => promise);

      const first = cache.getOrCompute(['a'], compute);
      const second = cache.getOrCompute(['a'], compute);

      resolve(['value', 1000]);

      expect(await first).toBe('value');
      expect(await second).toBe('value');
      expect(compute).toHaveBeenCalledTimes(1);
    });

    it('should share a rejection between concurrent callers', async () => {
      const { promise, reject } = Promise.withResolvers<[string, number]>();
      const compute = vitest.fn<Compute>(() => promise);

      const first = cache.getOrCompute(['a'], compute);
      const second = cache.getOrCompute(['a'], compute);

      reject(new Error('boom'));

      await expect(first).rejects.toThrow('boom');
      await expect(second).rejects.toThrow('boom');
      expect(compute).toHaveBeenCalledTimes(1);
    });

    it('should share a null result without caching it', async () => {
      const { promise, resolve } = Promise.withResolvers<null>();
      const compute = vitest.fn<Compute>(() => promise);

      const first = cache.getOrCompute(['a'], compute);
      const second = cache.getOrCompute(['a'], compute);

      resolve(null);

      expect(await first).toBeNull();
      expect(await second).toBeNull();
      expect(compute).toHaveBeenCalledTimes(1);

      compute.mockResolvedValueOnce(null);
      await cache.getOrCompute(['a'], compute);
      expect(compute).toHaveBeenCalledTimes(2);
    });

    it('should not share computations between different keys', async () => {
      const compute = vitest.fn<Compute>(async () => ['value', 1000]);

      await Promise.all([cache.getOrCompute(['a'], compute), cache.getOrCompute(['b'], compute)]);

      expect(compute).toHaveBeenCalledTimes(2);
    });
  });

  describe('caller signal', () => {
    it('should reject immediately if the signal is already aborted', async () => {
      const compute = vitest.fn<Compute>(async () => ['value', 1000]);

      await expect(cache.getOrCompute(['a'], compute, AbortSignal.abort())).rejects.toEqual(
        abortError,
      );

      expect(compute).not.toHaveBeenCalled();
    });

    it('should reject with the abort reason when the signal aborts', async () => {
      const controller = new AbortController();
      const reason = new Error('cancelled');

      const result = cache.getOrCompute(['a'], () => new Promise(() => {}), controller.signal);
      controller.abort(reason);

      await expect(result).rejects.toBe(reason);
    });

    it('should not abort the shared computation for other callers', async () => {
      const controller = new AbortController();
      const { promise, resolve } = Promise.withResolvers<[string, number]>();
      let computeSignal: AbortSignal | undefined;
      const compute = vitest.fn<Compute>((signal) => {
        computeSignal = signal;
        return promise;
      });

      const aborted = cache.getOrCompute(['a'], compute, controller.signal);
      const other = cache.getOrCompute(['a'], compute);

      controller.abort();
      await expect(aborted).rejects.toEqual(abortError);

      expect(computeSignal?.aborted).toBe(false);

      resolve(['value', 1000]);
      expect(await other).toBe('value');
    });

    it('should still cache the result of a computation whose caller aborted', async () => {
      const controller = new AbortController();
      const { promise, resolve } = Promise.withResolvers<[string, number]>();
      const compute = vitest.fn<Compute>(() => promise);

      const aborted = cache.getOrCompute(['a'], compute, controller.signal);
      controller.abort();
      await expect(aborted).rejects.toEqual(abortError);

      resolve(['value', 1000]);
      await promise;
      await setTimeout(0);

      expect(await cache.getOrCompute(['a'], compute)).toBe('value');
      expect(compute).toHaveBeenCalledTimes(1);
    });
  });

  describe('close', () => {
    it('should clear cached entries', async () => {
      await cache.getOrCompute(['a'], async () => ['value', 1000]);

      cache.close();

      expect(cache['cache'].size).toBe(0);
    });

    it('should reject further calls', async () => {
      cache.close();

      await expect(cache.getOrCompute(['a'], async () => ['value', 1000])).rejects.toEqual(
        abortError,
      );
    });

    it('should reject pending callers and abort in-flight computations', async () => {
      let computeSignal: AbortSignal | undefined;

      const result = cache.getOrCompute(['a'], (signal) => {
        computeSignal = signal;
        return new Promise(() => {});
      });
      await setTimeout(0);

      cache.close();

      await expect(result).rejects.toEqual(abortError);
      expect(computeSignal?.aborted).toBe(true);
    });

    it('should not cache results that resolve after close', async () => {
      const { promise, resolve } = Promise.withResolvers<[string, number]>();

      const result = cache.getOrCompute(['a'], () => promise);
      cache.close();
      await expect(result).rejects.toEqual(abortError);

      resolve(['value', 1000]);
      await setTimeout(0);

      expect(cache['cache'].size).toBe(0);
    });

    it('should be idempotent', () => {
      cache.close();

      expect(() => cache.close()).not.toThrow();
    });
  });
});

type Compute = (signal: AbortSignal) => Promise<CacheComputeResult<string>>;

const abortError = expect.objectContaining({ name: 'AbortError' });
