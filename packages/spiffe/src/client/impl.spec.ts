import { SpiffeWorkloadAPI } from '../proto/workloadapi_pb.js';
import { NoSvidError } from './error.js';
import { SpiffeClient } from './impl.js';
import type { ConnectRouter, ServiceImpl } from '@connectrpc/connect';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import * as fs from 'node:fs/promises';
import * as http2 from 'node:http2';
import { describe, beforeEach, it, Mock, beforeAll, expect, vitest } from 'vitest';

type FetchJWTSVIDImpl = ServiceImpl<typeof SpiffeWorkloadAPI>['fetchJWTSVID'];
type ValidateJWTSVIDImpl = ServiceImpl<typeof SpiffeWorkloadAPI>['validateJWTSVID'];

describe('SpiffeClientImpl', () => {
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

    client = new SpiffeClient(createMockTransport());

    return async () => {
      await client.close();
    };
  });

  describe('SpiffeJwtClient', () => {
    describe('getJwt', () => {
      const fakeJwt = `1.${Buffer.from(
        JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes in the future
        }),
        'utf-8',
      ).toString('base64url')}.`;
      const fakeJwt2 = `2.${Buffer.from(
        JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes in the future
        }),
        'utf-8',
      ).toString('base64url')}.`;

      it('should return JWT for the specified audience', async () => {
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
      });

      it('should request multiple audiences', async () => {
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
      });

      it('should cache the returned JWT', async () => {
        fetchJWTSVID.mockImplementation(() => {
          const fakeJwt = `.${Buffer.from(
            JSON.stringify({
              exp: Math.floor(Date.now() / 1000) + 2,
            }),
            'utf-8',
          ).toString('base64url')}.`;

          return {
            svids: [
              {
                spiffeId: 'spiffe://example.org/test',
                svid: fakeJwt,
                hint: '',
              },
            ],
          };
        });

        const firstJwt = await client.getJwt('test-audience');
        await client.getJwt('test-audience');

        expect(fetchJWTSVID).toHaveBeenCalledTimes(1);

        await new Promise((resolve) => setTimeout(resolve, 4000));

        expect(await client.getJwt('test-audience')).not.toBe(firstJwt);

        expect(fetchJWTSVID).toHaveBeenCalledTimes(2);
      });

      it('should filter for hint if provided', async () => {
        fetchJWTSVID.mockImplementationOnce(() => ({
          svids: [
            {
              spiffeId: 'spiffe://example.org/test1',
              svid: fakeJwt,
              hint: 'hint1',
            },
            {
              spiffeId: 'spiffe://example.org/test2',
              svid: fakeJwt2,
              hint: 'hint2',
            },
          ],
        }));

        expect(await client.getJwt('test-audience', 'hint2')).toBe(fakeJwt2);
      });

      it('should throw NoSvidError if no SVIDs are returned', async () => {
        fetchJWTSVID.mockImplementationOnce(() => ({ svids: [] }));

        await expect(client.getJwt('test-audience')).rejects.toThrow(NoSvidError);
      });

      it('should throw NoSvidError if call fails with PERMISSION_DENIED', async () => {
        fetchJWTSVID.mockImplementation(() => {
          throw new ConnectError('Permission denied', Code.PermissionDenied);
        });

        await using fastClient = new SpiffeClient(createMockTransport(), {
          maxAttempts: 2,
          initialDelayMs: 1,
          maxDelayMs: 1,
        });

        await expect(fastClient.getJwt('test-audience')).rejects.toThrow(NoSvidError);
      });
    });

    describe('validateJwt', () => {
      it('should return a decoded valid SVID', async () => {
        validateJWTSVID.mockImplementationOnce(() => ({
          spiffeId: 'fake-spiffe-id',
          claims: {
            sub: 'fake',
            aud: ['fake'],
            exp: 1234,
          },
        }));

        expect(await client.validateJwt('test-audience', 'test-token')).toEqual({
          spiffeId: 'fake-spiffe-id',
          claims: {
            sub: 'fake',
            aud: ['fake'],
            exp: 1234,
          },
        });
      });
    });
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
    const fakeJwt = `1.${Buffer.from(
      JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes in the future
      }),
      'utf-8',
    ).toString('base64url')}.`;

    fetchJWTSVID.mockImplementationOnce(() => ({
      svids: [
        {
          spiffeId: 'spiffe://example.org/test',
          svid: fakeJwt,
          hint: '',
        },
      ],
    }));

    await using client = new SpiffeClient(socketUri);

    expect(await client.getJwt('test-audience')).toBe(fakeJwt);
  });
});
