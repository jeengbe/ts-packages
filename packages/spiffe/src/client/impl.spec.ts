import { SpiffeWorkloadAPI } from '../proto/workloadapi_pb.js';
import { NoSvidError } from './error.js';
import { SpiffeClient } from './impl.js';
import type { ConnectRouter, ServiceImpl } from '@connectrpc/connect';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import * as fs from 'node:fs/promises';
import * as http2 from 'node:http2';
import { setTimeout } from 'node:timers/promises';
import { beforeAll, beforeEach, describe, expect, it, Mock, vitest } from 'vitest';

type FetchJWTSVIDImpl = ServiceImpl<typeof SpiffeWorkloadAPI>['fetchJWTSVID'];
type ValidateJWTSVIDImpl = ServiceImpl<typeof SpiffeWorkloadAPI>['validateJWTSVID'];

describe('SpiffeClient', () => {
  let fetchJWTSVID: Mock<FetchJWTSVIDImpl>;
  let validateJWTSVID: Mock<ValidateJWTSVIDImpl>;
  let client: SpiffeClient;

  // In-memory transport routed straight to the mocks above, no real socket involved. Retry
  // tests need their own client (different retryOptions) wired to the same mocks, hence a helper
  // rather than a single transport built once.
  function createMockTransport() {
    return createRouterTransport((router: ConnectRouter) => {
      router.service(SpiffeWorkloadAPI, {
        fetchJWTSVID: (req, ctx) => fetchJWTSVID(req, ctx),
        validateJWTSVID: (req, ctx) => validateJWTSVID(req, ctx),
      });
    });
  }

  beforeEach(() => {
    fetchJWTSVID = vitest.fn<FetchJWTSVIDImpl>(() => {
      throw new ConnectError('Not implemented', Code.Unimplemented);
    });
    validateJWTSVID = vitest.fn<ValidateJWTSVIDImpl>(() => {
      throw new ConnectError('Not implemented', Code.Unimplemented);
    });

    client = new SpiffeClient({
      connection: createMockTransport(),
    });

    return async () => {
      await client.close();
    };
  });

  describe('getJwt', () => {
    it('should return JWT for the specified audience', async () => {
      const fakeJwt = createFakeJwtSvid();

      fetchJWTSVID.mockImplementationOnce(() => ({
        svids: [
          {
            spiffeId: 'spiffe://example.org/test',
            svid: fakeJwt,
            hint: '',
          },
        ],
      }));

      expect(await client.getJwt('test-audience')).toBe(fakeJwt);

      expect(fetchJWTSVID).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: ['test-audience'],
        }),
        expect.anything(),
      );
    });

    it('should request multiple audiences', async () => {
      const fakeJwt = createFakeJwtSvid();

      fetchJWTSVID.mockImplementationOnce(() => ({
        svids: [
          {
            spiffeId: 'spiffe://example.org/test',
            svid: fakeJwt,
            hint: '',
          },
        ],
      }));

      expect(await client.getJwt(['test-audience', 'test-audience-2'])).toBe(fakeJwt);

      expect(fetchJWTSVID).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: ['test-audience', 'test-audience-2'],
        }),
        expect.anything(),
      );
    });

    it('should cache the returned JWT', async () => {
      fetchJWTSVID.mockImplementation(() => ({
        svids: [
          {
            spiffeId: 'spiffe://example.org/test',
            svid: createFakeJwtSvid(undefined, 1), // 1 second expiry
            hint: '',
          },
        ],
      }));

      const firstJwt = await client.getJwt('test-audience');
      expect(await client.getJwt('test-audience')).toBe(firstJwt);

      expect(fetchJWTSVID).toHaveBeenCalledTimes(1);

      // Wait for the cached JWT to expire
      await setTimeout(4000);

      expect(await client.getJwt('test-audience')).not.toBe(firstJwt);

      expect(fetchJWTSVID).toHaveBeenCalledTimes(2);
    });

    it('should filter for hint if provided', async () => {
      const fakeJwt1 = createFakeJwtSvid('1');
      const fakeJwt2 = createFakeJwtSvid('2');

      fetchJWTSVID.mockImplementationOnce(() => ({
        svids: [
          {
            spiffeId: 'spiffe://example.org/test1',
            svid: fakeJwt1,
            hint: 'hint1',
          },
          {
            spiffeId: 'spiffe://example.org/test2',
            svid: fakeJwt2,
            hint: 'hint2',
          },
        ],
      }));

      expect(await client.getJwt('test-audience', { hint: 'hint2' })).toBe(fakeJwt2);
    });

    it('should filter for the SPIFFE ID', async () => {
      const fakeJwt = createFakeJwtSvid();

      fetchJWTSVID.mockImplementationOnce(() => ({
        svids: [
          {
            spiffeId: 'spiffe://example.org/test1',
            svid: fakeJwt,
            hint: '',
          },
        ],
      }));

      expect(await client.getJwt('test-audience', { spiffeId: 'spiffe://example.org/test1' })).toBe(
        fakeJwt,
      );

      expect(fetchJWTSVID).toHaveBeenCalledWith(
        expect.objectContaining({
          spiffeId: 'spiffe://example.org/test1',
        }),
        expect.anything(),
      );
    });

    it('should throw NoSvidError if no SVIDs are returned', async () => {
      fetchJWTSVID.mockImplementationOnce(() => ({ svids: [] }));

      await expect(client.getJwt('test-audience')).rejects.toThrow(NoSvidError);
    });

    it('should throw NoSvidError if call fails with PERMISSION_DENIED', async () => {
      fetchJWTSVID.mockImplementation(() => {
        throw new ConnectError('Permission denied', Code.PermissionDenied);
      });

      await using fastClient = new SpiffeClient({
        connection: createMockTransport(),
        retry: { enabled: false },
      });

      await expect(fastClient.getJwt('test-audience')).rejects.toThrow(NoSvidError);
    });
  });

  describe('getJwtSvid', () => {
    it('should return JWT for the specified audience', async () => {
      const fakeJwt = createFakeJwtSvid();

      fetchJWTSVID.mockImplementationOnce(() => ({
        svids: [
          {
            spiffeId: 'spiffe://example.org/test',
            svid: fakeJwt,
            hint: '',
          },
        ],
      }));

      expect(await client.getJwtSvid('test-audience')).toEqual({
        spiffeId: 'spiffe://example.org/test',
        token: fakeJwt,
        hint: undefined,
        expiresAtMs: expect.any(Number),
      });

      expect(fetchJWTSVID).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: ['test-audience'],
        }),
        expect.anything(),
      );
    });

    it('should request multiple audiences', async () => {
      const fakeJwt = createFakeJwtSvid();

      fetchJWTSVID.mockImplementationOnce(() => ({
        svids: [
          {
            spiffeId: 'spiffe://example.org/test',
            svid: fakeJwt,
            hint: '',
          },
        ],
      }));

      expect(await client.getJwtSvid(['test-audience', 'test-audience-2'])).toEqual({
        spiffeId: 'spiffe://example.org/test',
        token: fakeJwt,
        hint: undefined,
        expiresAtMs: expect.any(Number),
      });

      expect(fetchJWTSVID).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: ['test-audience', 'test-audience-2'],
        }),
        expect.anything(),
      );
    });

    it('should cache the returned JWT', async () => {
      fetchJWTSVID.mockImplementation(() => ({
        svids: [
          {
            spiffeId: 'spiffe://example.org/test',
            svid: createFakeJwtSvid(undefined, 1), // 1 second expiry
            hint: '',
          },
        ],
      }));

      const firstJwt = await client.getJwtSvid('test-audience');
      expect(await client.getJwtSvid('test-audience')).toBe(firstJwt);

      expect(fetchJWTSVID).toHaveBeenCalledTimes(1);

      // Wait for the cached JWT to expire
      await setTimeout(4000);

      expect(await client.getJwtSvid('test-audience')).not.toBe(firstJwt);

      expect(fetchJWTSVID).toHaveBeenCalledTimes(2);
    });

    it('should filter for hint if provided', async () => {
      const fakeJwt1 = createFakeJwtSvid('1');
      const fakeJwt2 = createFakeJwtSvid('2');

      fetchJWTSVID.mockImplementationOnce(() => ({
        svids: [
          {
            spiffeId: 'spiffe://example.org/test1',
            svid: fakeJwt1,
            hint: 'hint1',
          },
          {
            spiffeId: 'spiffe://example.org/test2',
            svid: fakeJwt2,
            hint: 'hint2',
          },
        ],
      }));

      expect(await client.getJwtSvid('test-audience', { hint: 'hint2' })).toEqual({
        spiffeId: 'spiffe://example.org/test2',
        token: fakeJwt2,
        hint: 'hint2',
        expiresAtMs: expect.any(Number),
      });
    });

    it('should filter for the SPIFFE ID', async () => {
      const fakeJwt = createFakeJwtSvid();

      fetchJWTSVID.mockImplementationOnce(() => ({
        svids: [
          {
            spiffeId: 'spiffe://example.org/test1',
            svid: fakeJwt,
            hint: '',
          },
        ],
      }));

      expect(
        await client.getJwtSvid('test-audience', { spiffeId: 'spiffe://example.org/test1' }),
      ).toEqual({
        spiffeId: 'spiffe://example.org/test1',
        token: fakeJwt,
        hint: undefined,
        expiresAtMs: expect.any(Number),
      });

      expect(fetchJWTSVID).toHaveBeenCalledWith(
        expect.objectContaining({
          spiffeId: 'spiffe://example.org/test1',
        }),
        expect.anything(),
      );
    });

    it('should return null if no SVIDs are returned', async () => {
      fetchJWTSVID.mockImplementationOnce(() => ({ svids: [] }));

      expect(await client.getJwtSvid('test-audience')).toBeNull();
    });

    it('should return null if call fails with PERMISSION_DENIED', async () => {
      fetchJWTSVID.mockImplementation(() => {
        throw new ConnectError('Permission denied', Code.PermissionDenied);
      });

      await using fastClient = new SpiffeClient({
        connection: createMockTransport(),
        retry: { enabled: false },
      });

      expect(await fastClient.getJwtSvid('test-audience')).toBeNull();
    });
  });

  describe('validateJwt', () => {
    it('should return a decoded valid SVID', async () => {
      mockValidSvid();

      expect(await client.validateJwt('test-audience', 'test-token')).toEqual({
        spiffeId: 'fake-spiffe-id',
        claims: {
          sub: 'fake',
          aud: ['fake'],
          exp: expect.any(Number),
        },
      });

      expect(validateJWTSVID).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: 'test-audience',
          svid: 'test-token',
        }),
        expect.anything(),
      );
    });

    it('should cache the validated SVID', async () => {
      mockValidSvid();

      const first = await client.validateJwt('test-audience', 'test-token');

      expect(await client.validateJwt('test-audience', 'test-token')).toEqual(first);
      expect(validateJWTSVID).toHaveBeenCalledTimes(1);
    });

    it('should cache per token and audience', async () => {
      mockValidSvid();

      await client.validateJwt('test-audience', 'test-token');
      await client.validateJwt('test-audience', 'other-token');
      await client.validateJwt('other-audience', 'test-token');

      expect(validateJWTSVID).toHaveBeenCalledTimes(3);
    });

    it('should not cache beyond the token expiry', async () => {
      mockValidSvid(Math.floor(Date.now() / 1000) + 1);

      await client.validateJwt('test-audience', 'test-token');

      await setTimeout(1500);

      await client.validateJwt('test-audience', 'test-token');

      expect(validateJWTSVID).toHaveBeenCalledTimes(2);
    });

    it('should not cache rejected tokens', async () => {
      validateJWTSVID.mockImplementation(() => {
        throw new ConnectError('Invalid token', Code.InvalidArgument);
      });

      expect(await client.validateJwt('test-audience', 'test-token')).toBeNull();
      expect(await client.validateJwt('test-audience', 'test-token')).toBeNull();

      expect(validateJWTSVID).toHaveBeenCalledTimes(2);
    });

    function mockValidSvid(exp = Math.floor(Date.now() / 1000) + 10 * 60): void {
      validateJWTSVID.mockImplementation(() => ({
        spiffeId: 'fake-spiffe-id',
        claims: {
          sub: 'fake',
          aud: ['fake'],
          exp,
        },
      }));
    }
  });
});

describe('SpiffeClient socket resolution', () => {
  let socketPath: string;
  let socketUri: string;
  let fetchJWTSVID: Mock<FetchJWTSVIDImpl>;

  beforeAll(async () => {
    socketPath = `${await fs.mkdtemp('/tmp/spiffe-client-test-')}/socket.sock`;
    socketUri = `unix://${socketPath}`;

    const server = http2.createServer(
      connectNodeAdapter({
        routes: (router: ConnectRouter) => {
          router.service(SpiffeWorkloadAPI, {
            fetchJWTSVID: (req, ctx) => fetchJWTSVID(req, ctx),
            validateJWTSVID: () => {
              throw new ConnectError('Not implemented', Code.Unimplemented);
            },
          });
        },
      }),
    );

    await new Promise<void>((resolve, reject) => {
      server.listen(socketPath, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    return async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    };
  });

  beforeEach(() => {
    fetchJWTSVID = vitest.fn<FetchJWTSVIDImpl>(() => {
      throw new ConnectError('Not implemented', Code.Unimplemented);
    });
  });

  it('should connect over a unix:// socket and fetch a JWT SVID', async () => {
    const fakeJwt = createFakeJwtSvid();

    fetchJWTSVID.mockImplementationOnce(() => ({
      svids: [
        {
          spiffeId: 'spiffe://example.org/test',
          svid: fakeJwt,
          hint: '',
        },
      ],
    }));

    await using client = new SpiffeClient({
      connection: socketUri,
    });

    expect(await client.getJwt('test-audience')).toBe(fakeJwt);
  });
});

function createFakeJwtSvid(value: string = '', expiresInSeconds: number = 60): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;

  return `.${Buffer.from(JSON.stringify({ exp, val: value }), 'utf-8').toString('base64url')}.`;
}
