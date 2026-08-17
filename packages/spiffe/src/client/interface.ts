// oxlint-disable-next-line no-unused-vars -- Used in JSDoc
import type { NoSvidError } from './error.js';

import { ParsedJwtSvid, ValidatedJwtSvid } from './types.js';

/**
 * The SPIFFE JWT Client provides convenience APIs for working with JWT-SVIDs.
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
  getJwt(
    audience: string | readonly string[],
    hint?: string,
    signal?: AbortSignal,
  ): Promise<string>;

  /**
   * Fetches a JWT-SVID for the specified audience and returns the SVID.
   *
   * @throws {NoSvidError} if the API returns no SVIDs for the specified filter.
   */
  getJwtSvid(
    audience: string | readonly string[],
    hint?: string,
    signal?: AbortSignal,
  ): Promise<ParsedJwtSvid>;

  /**
   * Validates a JWT-SVID and returns the validated payload if accepted, or null if
   * the token is malformed or not untrusted.
   */
  validateJwt(
    expectedAudience: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<ValidatedJwtSvid | null>;
}
