import type { SpiffeClientRetryOptions } from './types.js';
import { setTimeout } from 'node:timers/promises';

export async function retry<T>(
  fetch: (signal: AbortSignal) => Promise<T>,
  retryOptions: SpiffeClientRetryOptions = {},
  shouldRetry: (err: unknown) => boolean,
  signal: AbortSignal,
): Promise<T> {
  const {
    enabled = true,
    maxAttempts = 6,
    initialDelayMs = 1_000,
    maxDelayMs = 30_000,
  } = retryOptions;

  if (!enabled) {
    return fetch(signal);
  }

  let lastRetriableErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);

      await setTimeout(delay, undefined, { signal });
    }

    try {
      return await fetch(signal);
    } catch (err) {
      if (shouldRetry(err)) {
        lastRetriableErr = err;
        continue;
      }

      throw err;
    }
  }

  // oxlint-disable-next-line typescript/no-non-null-assertion -- Only reachable if something was thrown
  throw lastRetriableErr!;
}
