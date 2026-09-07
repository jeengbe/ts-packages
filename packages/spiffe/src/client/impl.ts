import type {
  JWTSVID,
  JWTSVIDResponse,
  ValidateJWTSVIDResponse,
  X509SVID,
} from '../proto/workloadapi_pb.js';
import { SpiffeWorkloadAPI } from '../proto/workloadapi_pb.js';
import { SpiffeCache, SpiffeCacheImpl } from './cache.js';
import { NoSvidError } from './error.js';
import { SpiffeJwtClient, SvidFilter } from './interface.js';
import { retry } from './retry.js';
import type {
  JwtSvid,
  SpiffeClientOptions,
  SpiffeClientRetryOptions,
  ValidatedJwtSvid,
} from './types.js';
import type { Client, Transport } from '@connectrpc/connect';
import { Code, ConnectError, createClient } from '@connectrpc/connect';
import { createGrpcTransport, Http2SessionManager } from '@connectrpc/connect-node';
import assert from 'node:assert/strict';
import { connect as netConnect } from 'node:net';

const JWT_SVID_CACHE_MAX_ENTRIES = 1_000;
const JWT_SVID_CACHE_MAX_TTL_MS = 60_000;
const SPIFFE_ID_CACHE_MAX_ENTRIES = 1_000;
const SPIFFE_ID_CACHE_MAX_TTL_MS = 60_000;
const VALIDATED_JWT_CACHE_MAX_ENTRIES = 1_000;
const VALIDATED_JWT_CACHE_MAX_TTL_MS = 60_000;

/**
 * The SPIFFE Client provides convenience APIs for interacting with the SPIFFE Workload API.
 */
export class SpiffeClient implements SpiffeJwtClient, AsyncDisposable {
  private readonly jwtSvidCache: SpiffeCache<JwtSvid>;
  private readonly spiffeIdCache: SpiffeCache<string>;
  private readonly validatedJwtCache: SpiffeCache<ValidatedJwtSvid>;

  private readonly retryOptions: SpiffeClientRetryOptions | undefined;

  /**
   * Only set when this client created its own connection (i.e. was not given a transport), so
   * that `close()` never tears down a caller-owned transport.
   */
  private readonly sessionManager: Http2SessionManager | undefined;

  /**
   * The underlying gRPC client for the SPIFFE Workload API.
   */
  readonly api: Client<typeof SpiffeWorkloadAPI>;

  constructor(options: SpiffeClientOptions = {}) {
    if (typeof options.connection === 'object') {
      this.sessionManager = undefined;
      this.api = createClient(SpiffeWorkloadAPI, options.connection);
    } else {
      this.sessionManager = createSessionManagerFromSocket(resolveSocket(options.connection));
      this.api = createClient(SpiffeWorkloadAPI, createWorkloadGrpcTransport(this.sessionManager));
    }

    ({
      jwtSvidCache: this.jwtSvidCache = new SpiffeCacheImpl<JwtSvid>({
        maxEntries: JWT_SVID_CACHE_MAX_ENTRIES,
        maxTtlMs: JWT_SVID_CACHE_MAX_TTL_MS,
      }),
      spiffeIdCache: this.spiffeIdCache = new SpiffeCacheImpl<string>({
        maxEntries: SPIFFE_ID_CACHE_MAX_ENTRIES,
        maxTtlMs: SPIFFE_ID_CACHE_MAX_TTL_MS,
      }),
      validatedJwtCache: this.validatedJwtCache = new SpiffeCacheImpl<ValidatedJwtSvid>({
        maxEntries: VALIDATED_JWT_CACHE_MAX_ENTRIES,
        maxTtlMs: VALIDATED_JWT_CACHE_MAX_TTL_MS,
      }),
      retry: this.retryOptions,
    } = options);
  }

  async getJwt(
    audience: string | readonly string[],
    filter?: SvidFilter,
    signal?: AbortSignal,
  ): Promise<string> {
    const svid = await this.getJwtSvid(audience, filter, signal);

    if (!svid) {
      throw new NoSvidError(filter);
    }

    return svid.token;
  }

  async getJwtSvid(
    audience: string | readonly string[],
    filter?: SvidFilter,
    signal?: AbortSignal,
  ): Promise<JwtSvid | null> {
    const aud = typeof audience === 'string' ? [audience] : audience;

    return this.jwtSvidCache.getOrCompute(
      [...aud.toSorted(), filter?.hint ?? '', filter?.spiffeId ?? ''],
      async (cacheSignal) => {
        const svid = await this._getJwtSvid(aud, filter, cacheSignal);

        if (!svid) {
          return null;
        }

        const expiresAtMs = getExpiresAtMs(getJwtClaims(svid.svid));
        // https://github.com/spiffe/spiffe/blob/f97c46dfd0ff0d4e412cce5c73846a9ca32a99a2/standards/JWT-SVID.md#33-expiration-time Required
        assert.ok(expiresAtMs !== null, 'JWT-SVID does not contain an "exp" claim');

        const jwt: JwtSvid = {
          spiffeId: svid.spiffeId,
          token: svid.svid,
          hint: svid.hint || undefined, // Empty hint -> gRPC undefined
          expiresAtMs,
        };

        return [jwt, Math.floor((expiresAtMs - Date.now()) / 2)];
      },
      signal,
    );
  }

  async getSpiffeId(filter?: SvidFilter, signal?: AbortSignal): Promise<string> {
    const spiffeId = await this.spiffeIdCache.getOrCompute(
      [filter?.hint ?? '', filter?.spiffeId ?? ''],
      async (cacheSignal) => {
        const svid = await this._getJwtSvid(['dummy'], filter, cacheSignal);

        if (!svid) {
          return null;
        }

        const expiresAtMs = getExpiresAtMs(getJwtClaims(svid.svid));
        // https://github.com/spiffe/spiffe/blob/f97c46dfd0ff0d4e412cce5c73846a9ca32a99a2/standards/JWT-SVID.md#33-expiration-time Required
        assert.ok(expiresAtMs !== null, 'JWT-SVID does not contain an "exp" claim');

        return [svid.spiffeId, Math.floor((expiresAtMs - Date.now()) / 2)];
      },
      signal,
    );

    if (!spiffeId) {
      throw new NoSvidError(filter);
    }

    return spiffeId;
  }

  async validateJwt(
    expectedAudience: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<ValidatedJwtSvid | null> {
    return this.validatedJwtCache.getOrCompute(
      [token, expectedAudience],
      async (cacheSignal) => {
        const validated = await this._validateJwt(expectedAudience, token, cacheSignal);

        if (!validated) {
          return null;
        }

        const expiresAtMs = getExpiresAtMs(validated.claims);
        // https://github.com/spiffe/spiffe/blob/f97c46dfd0ff0d4e412cce5c73846a9ca32a99a2/standards/JWT-SVID.md#33-expiration-time Required
        assert.ok(expiresAtMs !== null, 'JWT-SVID does not contain an "exp" claim');

        return [validated, expiresAtMs - Date.now()];
      },
      signal,
    );
  }

  private async _getJwtSvid(
    aud: readonly string[],
    filter: SvidFilter | undefined,
    signal: AbortSignal,
  ): Promise<JWTSVID | undefined> {
    let res: JWTSVIDResponse;
    try {
      res = await retry(
        (retrySignal) =>
          this.api.fetchJWTSVID(
            {
              audience: [...aud],
              spiffeId: filter?.spiffeId ?? '',
            },
            retrySignal ? { signal: retrySignal } : undefined,
          ),
        this.retryOptions,
        (err) => err instanceof ConnectError && isRetriableFetchSvidErrorCode(err.code),
        signal,
      );
    } catch (err) {
      if (err instanceof ConnectError && err.code === Code.PermissionDenied) {
        // PERMISSION_DENIED means no SVID
        return undefined;
      }

      throw err;
    }

    return getFirstSvid(res.svids, filter);
  }

  private async _validateJwt(
    expectedAudience: string,
    token: string,
    signal: AbortSignal,
  ): Promise<ValidatedJwtSvid | null> {
    let res: ValidateJWTSVIDResponse;
    try {
      res = await retry(
        (retrySignal) =>
          this.api.validateJWTSVID(
            {
              audience: expectedAudience,
              svid: token,
            },
            retrySignal ? { signal: retrySignal } : undefined,
          ),
        this.retryOptions,
        (err) => err instanceof ConnectError && isRetriableValidateJwtErrorCode(err.code),
        signal,
      );
    } catch (err) {
      if (err instanceof ConnectError && err.code === Code.InvalidArgument) {
        // INVALID_ARGUMENT means the token is invalid or expired
        return null;
      }

      throw err;
    }

    return {
      spiffeId: res.spiffeId,
      // oxlint-disable-next-line typescript/no-non-null-assertion typescript/consistent-type-assertions -- The proto describes this field as required
      claims: res.claims! as Partial<Record<string, unknown>>,
    };
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  async close(): Promise<void> {
    this.jwtSvidCache.close();
    this.spiffeIdCache.close();
    this.validatedJwtCache.close();

    this.sessionManager?.abort();
  }
}

function resolveSocket(socket?: string): string {
  return (
    socket ?? process.env['SPIFFE_ENDPOINT_SOCKET'] ?? 'unix:///tmp/spire-agent/public/api.sock'
  );
}

function createWorkloadGrpcTransport(sessionManager: Http2SessionManager): Transport {
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

function getJwtClaims(token: string): Partial<Record<string, unknown>> {
  // oxlint-disable-next-line typescript/no-non-null-assertion typescript/consistent-type-assertions -- Expect a valid JWT from the Workload API
  return JSON.parse(Buffer.from(token.split('.').at(1)!, 'base64url').toString('utf-8')) as Partial<
    Record<string, unknown>
  >;
}

function getExpiresAtMs(claims: Partial<Record<string, unknown>>): number | null {
  const exp = claims['exp'];

  if (typeof exp !== 'number') {
    return null;
  }

  return exp * 1000;
}

function getFirstSvid<T extends JWTSVID | X509SVID>(
  svids: readonly T[],
  filter?: SvidFilter,
): T | undefined {
  // The Workload API can filter by SPIFFE ID already.
  return svids.find((s) => !filter?.hint || s.hint === filter.hint);
}

function isRetriableFetchSvidErrorCode(code: Code): boolean {
  // PermissionDenied: workload not yet registered in SPIRE (transient at pod startup)
  // Unavailable: SPIRE agent socket not ready yet
  return code === Code.PermissionDenied || code === Code.Unavailable;
}

function isRetriableValidateJwtErrorCode(code: Code): boolean {
  // Unavailable: SPIRE agent socket not ready yet
  return code === Code.Unavailable;
}
