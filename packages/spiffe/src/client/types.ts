import { SpiffeCache } from './cache.js';
import { Transport } from '@connectrpc/connect';

/**
 * A parsed JWT-SVID.
 */
export interface JwtSvid {
  spiffeId: string;
  token: string;
  hint: string | undefined;
  expiresAtMs: number;
}

/**
 * A validated JWT-SVID, including the SPIFFE ID and claims of the decoded JWT.
 */
export interface ValidatedJwtSvid {
  spiffeId: string;

  /**
   * Claims of the decoded JWT.
   */
  claims: Partial<Record<string, unknown>>;
}

/**
 * Options for configuring a `SpiffeClient`.
 */
export interface SpiffeClientOptions {
  /**
   * Socket path or `@connectrpc/connect` transport for communicating with the Workload API.
   *
   * If no socket is provided, the `SPIFFE_ENDPOINT_SOCKET` environment variable will be used,
   * and if neither are set, defaults to `unix:///tmp/spire-agent/public/api.sock`.
   *
   * If you provide a custom transport, don't forget to set the `workload.spiffe.io` gRPC metadata
   * to `true` in the options.
   *
   * @see https://github.com/spiffe/spiffe/blob/main/standards/SPIFFE_Workload_Endpoint.md
   *
   * @default process.env['SPIFFE_ENDPOINT_SOCKET'] ?? 'unix:///tmp/spire-agent/public/api.sock'
   */
  connection?: string | Transport;

  /**
   * Cache for fetched JWT-SVIDs.
   *
   * @default SpiffeCacheImpl[maxEntries=1000;maxTtlMs=60_000]
   */
  jwtSvidCache?: SpiffeCache<JwtSvid>;

  /**
   * Cache for own SPIFFE IDs.
   *
   * @default SpiffeCacheImpl[maxEntries=1000;maxTtlMs=60_000]
   */
  spiffeIdCache?: SpiffeCache<string>;

  /**
   * Cache for validated JWT-SVIDs.
   *
   * @default SpiffeCacheImpl[maxEntries=1000;maxTtlMs=60_000]
   */
  validatedJwtCache?: SpiffeCache<ValidatedJwtSvid>;

  /**
   * Retry behaviour for Workload API calls.
   */
  retry?: SpiffeClientRetryOptions;
}

/**
 * Options for configuring retry behavior of Workload API calls.
 */
export interface SpiffeClientRetryOptions {
  /**
   * Whether to enable retrying on failure.
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * Maximum number of fetch attempts, including the first.
   *
   * @default 6
   */
  maxAttempts?: number;

  /**
   * Delay before the first retry in milliseconds. Doubles with each subsequent attempt, up
   * to `maxDelayMs`.
   *
   * @default 1000
   */
  initialDelayMs?: number;

  /**
   * Maximum delay between retries in milliseconds.
   *
   * @default 30_000
   */
  maxDelayMs?: number;
}
