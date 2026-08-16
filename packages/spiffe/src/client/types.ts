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
