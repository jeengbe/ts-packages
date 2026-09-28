import { TTLCache } from '@isaacs/ttlcache';

/**
 * `[value, ttlMs]` caches `value` for `ttlMs`.
 * `null` means "no value": it is returned to the callers but not cached.
 */
export type CacheComputeResult<T> = readonly [value: T, ttlMs: number] | null;

/**
 * Cache for SPIFFE operations.
 */
export interface SpiffeCache<T> {
  /**
   * Returns the cached value for `key`, or runs `compute` to produce it.
   */
  getOrCompute(
    key: readonly string[],
    compute: (signal: AbortSignal) => Promise<CacheComputeResult<T>>,
    signal?: AbortSignal,
  ): Promise<T | null>;

  /**
   * Clears the cache and aborts in-flight computations. Called when the client is closed.
   */
  close(): void;
}

export interface CacheOptions {
  /**
   * Maximum number of cached entries. Unbounded if omitted.
   */
  maxEntries?: number;

  /**
   * Upper bound for the TTL of an entry. Unbounded if omitted.
   */
  maxTtlMs?: number;
}

/**
 * In-memory `SpiffeCache` that deduplicates concurrent computations for the same key.
 */
export class SpiffeCacheImpl<T> implements SpiffeCache<T> {
  private readonly abortController = new AbortController();

  private readonly cache: TTLCache<string, T>;
  private readonly inFlight = new Map<string, Promise<T | null>>();

  constructor(private readonly options: CacheOptions) {
    this.cache = new TTLCache(options.maxEntries ? { max: options.maxEntries } : undefined);
  }

  async getOrCompute(
    key: readonly string[],
    compute: (signal: AbortSignal) => Promise<CacheComputeResult<T>>,
    signal?: AbortSignal,
  ): Promise<T | null> {
    const closeSignal = this.abortController.signal;
    closeSignal.throwIfAborted();
    signal?.throwIfAborted();

    const cacheKey = key.join('\0');

    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const promise = this.inFlight.get(cacheKey) ?? this.start(cacheKey, compute);

    return await raceAbort(promise, signal ? AbortSignal.any([closeSignal, signal]) : closeSignal);
  }

  close(): void {
    if (this.abortController.signal.aborted) {
      return;
    }

    this.abortController.abort();

    this.inFlight.clear();
    this.cache.clear();
    this.cache.cancelTimer();
  }

  private start(
    key: string,
    compute: (signal: AbortSignal) => Promise<CacheComputeResult<T>>,
  ): Promise<T | null> {
    const closeSignal = this.abortController.signal;

    const promise: Promise<T | null> = Promise.resolve()
      // Deferred to a microtask so a synchronous throw in `compute` can't run the cleanup below
      // before the entry is registered.
      .then(() => compute(closeSignal))
      .then((result) => {
        if (!result) {
          return null;
        }

        const [value, ttlMs] = result;

        if (ttlMs > 0 && !closeSignal.aborted) {
          this.cache.set(key, value, {
            ttl: Math.min(ttlMs, this.options.maxTtlMs ?? Infinity),
          });
        }

        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);

    return promise;
  }
}

function raceAbort<R>(promise: Promise<R>, signal: AbortSignal): Promise<R> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason);

    signal.addEventListener('abort', onAbort, { once: true });

    promise
      .finally(() => signal.removeEventListener('abort', onAbort))
      .then(resolve)
      .catch(reject);
  });
}
