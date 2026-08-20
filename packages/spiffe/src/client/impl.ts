import { SpiffeWorkloadAPI } from '../proto/workloadapi_pb.js';
import { NoSvidError } from './error.js';
import { SpiffeJwtClient } from './interface.js';
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
import { LRUCache } from 'lru-cache';
import { connect as netConnect } from 'node:net';
import { setTimeout } from 'node:timers/promises';

const VALIDATED_JWT_CACHE_MAX = 1_000;
const VALIDATED_JWT_CACHE_MAX_TTL_MS = 60_000;

/**
 * The SPIFFE Client provides convenience APIs for interacting with the SPIFFE Workload API.
 */
export class SpiffeClient implements SpiffeJwtClient, AsyncDisposable {
  private readonly jwtSvidCache = new TTLCache<string, ParsedJwtSvid>();
  private readonly jwtSvidsInFlight = new Map<string, Promise<readonly JwtSvid[]>>();

  private readonly validatedJwtCache = new LRUCache<string, ValidatedJwtSvid>({
    max: VALIDATED_JWT_CACHE_MAX,
    ttl: VALIDATED_JWT_CACHE_MAX_TTL_MS,
  });

  private readonly abortController = new AbortController();
  private readonly api: Client<typeof SpiffeWorkloadAPI>;

  /**
   * Constructs a SPIFFE Client instance with the given socket. If no socket is provided, the
   * `SPIFFE_ENDPOINT_SOCKET` environment variable will be used, and if neither are set, defaults
   * to `unix:///tmp/spire-agent/public/api.sock`.
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

  async getJwt(
    audience: string | readonly string[],
    hint?: string,
    signal?: AbortSignal,
  ): Promise<string> {
    return (await this.getJwtSvid(audience, hint, signal)).token;
  }

  async getJwtSvid(
    audience: string | readonly string[],
    hint?: string,
    signal?: AbortSignal,
  ): Promise<ParsedJwtSvid> {
    const aud = typeof audience === 'string' ? [audience] : audience;
    const cacheKey = [aud.join('|'), hint ?? ''].join(':');

    const cached = this.jwtSvidCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const svid = (await this.listJwtSvids(cacheKey, aud, hint, signal)).at(0);

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
    signal?: AbortSignal,
  ): Promise<readonly JwtSvid[]> {
    let inFlight = this.jwtSvidsInFlight.get(cacheKey);

    if (!inFlight) {
      inFlight = this._listJwtSvids(audience, hint, signal).finally(() => {
        this.jwtSvidsInFlight.delete(cacheKey);
      });
      this.jwtSvidsInFlight.set(cacheKey, inFlight);
    }

    return await inFlight;
  }

  private async _listJwtSvids(
    audience: readonly string[],
    hint?: string,
    signal?: AbortSignal,
  ): Promise<readonly JwtSvid[]> {
    const { maxAttempts = 6, initialDelayMs = 1_000, maxDelayMs = 30_000 } = this.retryOptions;
    const combinedSignal = this.combinedSignal(signal);

    let lastRetriableErr: ConnectError | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);

        await setTimeout(delay, undefined, { signal: combinedSignal });
      }

      try {
        const res = await this.api.fetchJWTSVID(
          {
            audience: [...audience],
            spiffeId: '',
          },
          { signal: combinedSignal },
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

  async validateJwt(
    expectedAudience: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<ValidatedJwtSvid | null> {
    const cacheKey = `${token}:${expectedAudience}`;
    const cached = this.validatedJwtCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    let res;
    try {
      res = await this.api.validateJWTSVID(
        {
          audience: expectedAudience,
          svid: token,
        },
        { signal: this.combinedSignal(signal) },
      );
    } catch (err) {
      if (err instanceof ConnectError && err.code === Code.InvalidArgument) {
        return null;
      }

      throw err;
    }

    const validated: ValidatedJwtSvid = {
      spiffeId: res.spiffeId,
      claims: (res.claims as Partial<Record<string, unknown>> | undefined) ?? {},
    };

    this.cacheValidatedJwt(cacheKey, validated);

    return validated;
  }

  private cacheValidatedJwt(cacheKey: string, validated: ValidatedJwtSvid): void {
    const exp = validated.claims['exp'];

    if (typeof exp !== 'number') {
      return;
    }

    const ttlRemainingMs = exp * 1000 - Date.now();

    if (ttlRemainingMs <= 0) {
      return;
    }

    this.validatedJwtCache.set(cacheKey, validated, {
      ttl: Math.min(ttlRemainingMs, VALIDATED_JWT_CACHE_MAX_TTL_MS),
    });
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  async close(): Promise<void> {
    this.abortController.abort();
    this.validatedJwtCache.clear();
  }

  private combinedSignal(signal?: AbortSignal): AbortSignal {
    return signal
      ? AbortSignal.any([signal, this.abortController.signal])
      : this.abortController.signal;
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

  const sessionManager = createSessionManagerFromSocket(socket);

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

function createSessionManagerFromSocket(socket: string): Http2SessionManager {
  if (socket.startsWith('unix://')) {
    const path = socket.slice('unix://'.length);

    // https://github.com/connectrpc/connect-es/issues/756#issuecomment-1700864148
    return new Http2SessionManager('http://localhost:0', undefined, {
      createConnection: () => netConnect(path),
    });
  }

  if (socket.startsWith('tcp://')) {
    return new Http2SessionManager(`http://${socket.slice('tcp://'.length)}`);
  }

  throw new Error(`Unsupported socket format: ${socket}. Only unix:// and tcp:// are supported.`);
}
