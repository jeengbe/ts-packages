import { SpiffeClient } from './client/index.js';
import type { SpiffeJwtClient } from './client/index.js';
import type { OauthbearerProviderResponse, SASLMechanismOptions } from 'kafkajs';
import type { Middleware, Request } from 'mappersmith';

/**
 * Create a KafkaJS SASL mechanism that uses a JWT-SVID bearer credential for authentication.
 *
 * @example
 *
 * ```ts
 * import { createKafkajsSaslMechanism } from '@jeengbe/spiffe/kafkajs';
 * import { Kafka } from 'kafkajs';
 *
 * const kafka = new Kafka({
 *   brokers: config.kafka.brokers,
 *   sasl: createKafkajsSaslMechanism('kafka-cluster'),
 * });
 * ```
 *
 * @example
 *
 * ```ts
 * createKafkajsSaslMechanism('kafka-cluster', {
 *   logicalCluster: 'lkc-abc123',
 *   identityPoolId: 'pool-xyz',
 * }),
 * ```
 */
export function createKafkajsSaslMechanism(
  audience: string,
  extensions?: Record<string, string>,
  hint?: string,
  spiffe: SpiffeJwtClient | (() => SpiffeJwtClient) = () => new SpiffeClient(),
): SASLMechanismOptions<'oauthbearer'> {
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

/**
 * Creates a Mappersmith middleware that adds an Authorization header with
 * a JWT-SVID bearer credential. Any additional headers passed via `headers`
 * are merged into the request after the Authorization header.
 *
 *  @example
 *
 * ```ts
 * import { createKafkajsAuthMiddleware } from '@jeengbe/spiffe/kafkajs';
 * import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
 *
 * const schemaRegistry = new SchemaRegistry({
 *   host: config.kafka.schemaRegistry.url,
 *   clientId: config.kafka.schemaRegistry.clientId,
 *   middlewares: [createKafkajsAuthMiddleware('confluent-cloud')],
 * });
 * ```
 *
 * @example
 *
 * ```ts
 * createKafkajsAuthMiddleware('confluent-cloud', {
 *   'target-sr-cluster': 'lsrc-abc123',
 *   'identity-pool-id': 'pool-xyz',
 * });
 * ```
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
    async prepareRequest(next): Promise<Request> {
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
