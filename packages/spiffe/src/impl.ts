import { NoSvidError } from './error.js';
import { SpiffeWorkloadAPI } from './proto/workloadapi_pb.js';
import type {
  JwtSvid,
  ParsedJwtSvid,
  SpiffeClientRetryOptions,
  ValidatedJwtSvid,
} from './types.js';
import type { Client, Transport } from '@connectrpc/connect';
import { Code, ConnectError, createClient } from '@connectrpc/connect';
import { createGrpcTransport, Http2SessionManager } from '@connectrpc/connect-node';
import { TTLCache } from '@isaacs/ttlcache';
import { connect as netConnect } from 'net';
import { setTimeout } from 'timers/promises';

/**
 * The SPIFFE Client provides convenience APIs for interacting with the SPIFFE Workload API.
 */
export class SpiffeClient implements AsyncDisposable {
  private readonly jwtSvidCache = new TTLCache<string, ParsedJwtSvid>();
  private readonly jwtSvidsInFlight = new Map<string, Promise<readonly JwtSvid[]>>();

  private readonly abortController = new AbortController();
  private readonly api: Client<typeof SpiffeWorkloadAPI>;

  /**
   * Constructs a SPIFFE Client instance with the given socket. If no socket is provided, the
   * `SPIFFE_ENDPOINT_SOCKET` environment variable will be used, and if neither are set, defaults
   * to `unix:///tmp/spire-agent/public/api.sock`.
   *
   * Format: `unix:///path/to/socket` for Unix domain sockets, or `tcp://host:port` for TCP sockets.
   *
   * @see https://github.com/spiffe/spiffe/blob/main/standards/SPIFFE_Workload_Endpoint.md#4-locating-the-endpoint
   */
  constructor(socket?: string, retryOptions?: SpiffeClientRetryOptions);

  /**
   * Constructs a SPIFFE Client instance with the given gRPC transport.
   *
   * (Do not forget to set the `workload.spiffe.io` gRPC metadata to `true` in the options.)
   *
   * @see https://github.com/spiffe/spiffe/blob/main/standards/SPIFFE_Workload_Endpoint.md
   */
  constructor(transport: Transport, retryOptions?: SpiffeClientRetryOptions);

  constructor(
    socketOrTransport?: string | Transport,
    private readonly retryOptions: SpiffeClientRetryOptions = {},
  ) {
    this.api = createClient(SpiffeWorkloadAPI, resolveGrpcTransport(socketOrTransport));
  }

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
  async getJwt(audience: string | readonly string[], hint?: string): Promise<string> {
    return (await this.getJwtSvid(audience, hint)).token;
  }

  /**
   * Fetches a JWT-SVID for the specified audience and returns the SVID.
   *
   * @throws {NoSvidError} if the API returns no SVIDs for the specified filter.
   */
  async getJwtSvid(audience: string | readonly string[], hint?: string): Promise<ParsedJwtSvid> {
    const aud = typeof audience === 'string' ? [audience] : audience;
    const cacheKey = [aud.join('|'), hint ?? ''].join(':');

    const cached = this.jwtSvidCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const svid = (await this.listJwtSvids(cacheKey, aud, hint)).at(0);

    if (!svid) {
      throw new NoSvidError('JWT', hint);
    }

    const expiresAtMs = getJwtExpMs(svid.token);
    const parsed: ParsedJwtSvid = {
      ...svid,
      expiresAtMs,
    };

    const ttlRemainingMs = expiresAtMs - Date.now();
    if (ttlRemainingMs > 0) {
      this.jwtSvidCache.set(cacheKey, parsed, {
        ttl: Math.ceil(ttlRemainingMs / 2),
      });
    }

    return parsed;
  }

  private async listJwtSvids(
    cacheKey: string,
    audience: readonly string[],
    hint?: string,
  ): Promise<readonly JwtSvid[]> {
    let inFlight = this.jwtSvidsInFlight.get(cacheKey);

    if (!inFlight) {
      inFlight = this._listJwtSvids(audience, hint).finally(() => {
        this.jwtSvidsInFlight.delete(cacheKey);
      });
      this.jwtSvidsInFlight.set(cacheKey, inFlight);
    }

    return await inFlight;
  }

  private async _listJwtSvids(
    audience: readonly string[],
    hint?: string,
  ): Promise<readonly JwtSvid[]> {
    const { maxAttempts = 6, initialDelayMs = 1_000, maxDelayMs = 30_000 } = this.retryOptions;

    let lastRetriableErr: ConnectError | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);

        await setTimeout(delay, undefined, {
          signal: this.abortController.signal,
        });
      }

      try {
        const res = await this.api.fetchJWTSVID(
          {
            audience: [...audience],
            spiffeId: '',
          },
          { signal: this.abortController.signal },
        );

        return res.svids
          .filter((svid) => !hint || svid.hint === hint)
          .map(
            (s): JwtSvid => ({
              spiffeId: s.spiffeId,
              token: s.svid,
            }),
          );
      } catch (err) {
        if (err instanceof ConnectError && isRetriableConnectCode(err.code)) {
          lastRetriableErr = err;
          continue;
        }

        throw err;
      }
    }

    // After exhausting retries, preserve the original PERMISSION_DENIED behaviour so the
    // caller gets NoSvidError rather than a raw ConnectError.
    if (lastRetriableErr?.code === Code.PermissionDenied) {
      return [];
    }

    throw lastRetriableErr!;
  }

  /**
   * Validates a JWT-SVID and returns the validated payload if accepted, or null if
   * the token is malformed or not untrusted.
   */
  async validateJwt(expectedAudience: string, token: string): Promise<ValidatedJwtSvid | null> {
    let res;
    try {
      res = await this.api.validateJWTSVID(
        {
          audience: expectedAudience,
          svid: token,
        },
        { signal: this.abortController.signal },
      );
    } catch (err) {
      if (err instanceof ConnectError && err.code === Code.InvalidArgument) {
        return null;
      }

      throw err;
    }

    return {
      spiffeId: res.spiffeId,
      claims: (res.claims as Partial<Record<string, unknown>> | undefined) ?? {},
    };
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  async close(): Promise<void> {
    this.abortController.abort();
  }
}

function isRetriableConnectCode(code: Code): boolean {
  // PermissionDenied: workload not yet registered in SPIRE (transient at pod startup)
  // Unavailable: SPIRE agent socket not ready yet
  return code === Code.PermissionDenied || code === Code.Unavailable;
}

function getJwtExpMs(token: string): number {
  const parsedPayload = JSON.parse(
    Buffer.from(token.split('.').at(1)!, 'base64url').toString('utf-8'),
  ) as { exp: number };

  return parsedPayload.exp * 1000;
}

function resolveGrpcTransport(socketOrTransport?: string | Transport): Transport {
  if (typeof socketOrTransport === 'object') {
    return socketOrTransport;
  }

  return createGrpcTransportFromSocket(socketOrTransport);
}

function createGrpcTransportFromSocket(socketOrTransport?: string): Transport {
  const socket =
    socketOrTransport ??
    process.env['SPIFFE_ENDPOINT_SOCKET'] ??
    'unix:///tmp/spire-agent/public/api.sock';

  if (!socket.startsWith('unix://')) {
    throw new Error(`Unsupported socket format: ${socket}. Only unix:// is supported.`);
  }

  const path = socket.slice('unix://'.length);

  // https://github.com/connectrpc/connect-es/issues/756#issuecomment-1700864148
  const sessionManager = new Http2SessionManager('http://localhost:0', undefined, {
    createConnection: () => netConnect(path),
  });

  return createGrpcTransport({
    baseUrl: 'http://localhost:0',
    sessionManager,
    interceptors: [
      (next) => (req) => {
        req.header.set('workload.spiffe.io', 'true');
        return next(req);
      },
    ],
  });
}
