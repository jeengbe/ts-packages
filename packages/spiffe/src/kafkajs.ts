import { SpiffeClient } from './impl.js';
import type { SpiffeJwtClient } from './interface.js';
import type { OauthbearerProviderResponse, SASLOptions } from 'kafkajs';
import type { Middleware } from 'mappersmith';

/**
 * Creates a Mappersmith middleware that adds an Authorization header with
 * a JWT-SVID bearer credential. Any additional headers passed via `headers`
 * are merged into the request after the Authorization header.
 */
export function createKafkajsAuthMiddleware(
  audience: string,
  headers?: Record<string, string>,
  hint?: string,
  spiffe: SpiffeJwtClient | (() => SpiffeJwtClient) = () => new SpiffeClient(),
): Middleware {
  const spiffeClient = typeof spiffe === 'function' ? spiffe() : spiffe;

  return () => ({
    __name: 'kafkajs-spiffe-auth-middleware',
    async prepareRequest(next) {
      const req = await next();

      return req.enhance({
        headers: {
          Authorization: `Bearer ${await spiffeClient.getJwt(audience, hint)}`,
          ...headers,
        },
      });
    },
  });
}

export function createKafkajsSaslMechanism(
  audience: string,
  extensions?: Record<string, string>,
  hint?: string,
  spiffe: SpiffeJwtClient | (() => SpiffeJwtClient) = () => new SpiffeClient(),
): SASLOptions {
  const spiffeClient = typeof spiffe === 'function' ? spiffe() : spiffe;

  return {
    mechanism: 'oauthbearer',
    async oauthBearerProvider(): Promise<OauthbearerProviderResponse> {
      return {
        value: await spiffeClient.getJwt(audience, hint),
        // @ts-expect-error -- Untyped SASL extensions type
        extensions,
      };
    },
  };
}
