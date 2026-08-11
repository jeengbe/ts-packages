// oxlint-disable-next-line no-unused-vars -- Used in JSDoc
import { NoSvidError } from './error.js';

/**
 * Provides high-level APIs for working with JWT-SVIDs with the SPIFFE Workload API.
 */
export interface SpiffeJwtClient {
  /**
   * Fetches a JWT-SVID for the specified audience and returns the JWT string.
   * If the workload is entitled to multiple SVIDs, the first one returned by the
   * Workload API is used.
   *
   * @example
   *
   * ```ts
   * const token = await spiffe.getJwt(['orders-api']);
   *
   * await fetch(url, {
   *   headers: { authorization: `Bearer ${token}` },
   * });
   * ```
   *
   * @throws {NoSvidError} if the API returns no SVIDs for the specified filter.
   */
  getJwt(audience: string | readonly string[], hint?: string): Promise<string>;

  /**
   * Fetches a JWT-SVID for the specified audience and returns the SVID.
   *
   * @throws {NoSvidError} if the API returns no SVIDs for the specified filter.
   */
  getJwtSvid(audience: string | readonly string[], hint?: string): Promise<ParsedJwtSvid>;

  /**
   * Validates a JWT-SVID and returns the validated payload if accepted, or null if
   * the token is malformed or not untrusted.
   */
  validateJwt(expectedAudience: string, token: string): Promise<ValidatedJwtSvid | null>;
}

/**
 * A JWT-SVID.
 */
export interface JwtSvid {
  spiffeId: string;
  token: string;
}

/**
 * A JWT-SVID that including the expiration time in milliseconds since the epoch.
 */
export interface ParsedJwtSvid extends JwtSvid {
  expiresAtMs: number;
}

/**
 * Options for configuring retry behavior when fetching SVIDs.
 */
export interface SpiffeClientRetryOptions {
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
