import type { SpiffeClientRetryOptions } from './types.js';
import pRetry from 'p-retry';

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

  return pRetry(() => fetch(signal), {
    retries: maxAttempts - 1,
    minTimeout: initialDelayMs,
    maxTimeout: maxDelayMs,
    factor: 2,
    signal,
    shouldRetry: ({ error }) => shouldRetry(error),
  });
}
