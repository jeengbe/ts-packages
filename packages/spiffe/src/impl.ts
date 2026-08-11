import { NoSvidError } from './error.js';
import type {
  JwtSvid,
  ParsedJwtSvid,
  SpiffeClientRetryOptions,
  SpiffeJwtClient,
  ValidatedJwtSvid,
} from './interface.js';
import { SpiffeWorkloadAPI } from './proto/workloadapi_pb.js';
import type { Client, Interceptor } from '@connectrpc/connect';
import { Code, ConnectError, createClient } from '@connectrpc/connect';
import type { GrpcTransportOptions } from '@connectrpc/connect-node';
import { createGrpcTransport, Http2SessionManager } from '@connectrpc/connect-node';
import { TTLCache } from '@isaacs/ttlcache';
import { connect as netConnect } from 'net';
import { setTimeout } from 'timers/promises';

const workloadApiHeaderInterceptor: Interceptor = (next) => (req) => {
  req.header.set('workload.spiffe.io', 'true');
  return next(req);
};

/**
 * The SPIFFE Client provides convenience APIs for interacting with the SPIFFE Workload API.
 */
export class SpiffeClient implements SpiffeJwtClient, AsyncDisposable {
  private readonly jwtSvidCache = new TTLCache<string, ParsedJwtSvid>();
  private readonly jwtSvidsInFlight = new Map<string, Promise<readonly JwtSvid[]>>();

  private readonly abortController = new AbortController();
  private readonly sessionManager: Http2SessionManager;
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
   * Constructs a SPIFFE Client instance with the given gRPC transport options.
   *
   * (Do not forget to set the `workload.spiffe.io` gRPC metadata to `true` in the options.)
   *
   * @see https://github.com/spiffe/spiffe/blob/main/standards/SPIFFE_Workload_Endpoint.md
   */
  constructor(options: GrpcTransportOptions, retryOptions?: SpiffeClientRetryOptions);

  constructor(
    socketOrOptions?: string | GrpcTransportOptions,
    private readonly retryOptions: SpiffeClientRetryOptions = {},
  ) {
    const options = resolveTransportOptions(socketOrOptions);

    this.sessionManager = new Http2SessionManager(options.baseUrl, undefined, options.nodeOptions);

    const transport = createGrpcTransport({
      ...options,
      sessionManager: this.sessionManager,
      interceptors: [workloadApiHeaderInterceptor, ...(options.interceptors ?? [])],
    });

    this.api = createClient(SpiffeWorkloadAPI, transport);
  }

  async getJwt(audience: string | readonly string[], hint?: string): Promise<string> {
    return (await this.getJwtSvid(audience, hint)).token;
  }

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
      inFlight = this.#listJwtSvids(audience, hint).finally(() => {
        this.jwtSvidsInFlight.delete(cacheKey);
      });
      this.jwtSvidsInFlight.set(cacheKey, inFlight);
    }

    return await inFlight;
  }

  async #listJwtSvids(audience: readonly string[], hint?: string): Promise<readonly JwtSvid[]> {
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
    this.sessionManager.abort();
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

function resolveTransportOptions(
  socketOrOptions?: string | GrpcTransportOptions,
): GrpcTransportOptions {
  if (typeof socketOrOptions === 'object') {
    return socketOrOptions;
  }

  const socket =
    socketOrOptions ??
    process.env['SPIFFE_ENDPOINT_SOCKET'] ??
    'unix:///tmp/spire-agent/public/api.sock';

  return parseSocket(socket);
}

function parseSocket(socket: string): GrpcTransportOptions {
  if (socket.startsWith('unix://')) {
    const path = socket.slice('unix://'.length);

    return {
      baseUrl: 'http://localhost',
      nodeOptions: {
        createConnection: () => netConnect(path),
      },
    };
  }

  if (socket.startsWith('tcp://')) {
    return { baseUrl: `http://${socket.slice('tcp://'.length)}` };
  }

  throw new Error(`Unsupported SPIFFE endpoint socket: ${socket}`);
}
