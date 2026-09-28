// oxlint-disable-next-line no-unused-vars -- Used in JSDoc
import type { NoSvidError } from './error.js';

import { JwtSvid, ValidatedJwtSvid } from './types.js';

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
   * @throws {NoSvidError} if the API returns no SVID.
   */
  getJwt(
    audience: string | readonly string[],
    filter?: SvidFilter,
    signal?: AbortSignal,
  ): Promise<string>;

  /**
   * Fetches a JWT-SVID for the specified audience and returns the SVID, or null
   * if the workload is not entitled to any SVIDs.
   */
  getJwtSvid(
    audience: string | readonly string[],
    filter?: SvidFilter,
    signal?: AbortSignal,
  ): Promise<JwtSvid | null>;

  /**
   * Validates a JWT-SVID and returns the validated payload if accepted, or null
   * if the token is malformed or not untrusted.
   */
  validateJwt(
    expectedAudience: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<ValidatedJwtSvid | null>;
}

/**
 * Options for filtering SVIDs when fetching from the Workload API. If multiple filters are provided,
 * a SVID has to match all; if multiple SVIDs match, the first one returned by the Workload API is used.
 */
export interface SvidFilter {
  /**
   * Hint to the Workload API for which SVID to fetch.
   */
  hint?: string;

  /**
   * The SPIFFE ID of the SVID to fetch.
   */
  spiffeId?: string;
}
