import { SpiffeClient } from './client/index.js';
import type { SpiffeJwtClient } from './client/index.js';
import type { OauthbearerProviderResponse, SASLMechanismOptions } from 'kafkajs';
import type { Request } from 'mappersmith' with {
  'resolution-mode': 'require',
};

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
export function createKafkajsAuthMiddleware<R extends MappersmithRequest<R> = Request>(
  audience: string,
  headers?: Record<string, string>,
  hint?: string,
  spiffe: SpiffeJwtClient | (() => SpiffeJwtClient) = () => new SpiffeClient(),
): MappersmithMiddleware<R> {
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

type MappersmithMiddleware<R extends MappersmithRequest<R>> = () => {
  __name: string;
  prepareRequest(next: () => Promise<R>): Promise<R>;
};

// Mappersmith exports different types for CJS/ESM, so when an ESM workspace imports the CJS package
// @kafkajs/confluent-schema-registry, the types are not compatible (types have different declaration of private property).
// So to fix this, we remove the dependency on mappersmith entirely and provide a compatible interface instead
// that is assignable to both CJS/ESM.
interface MappersmithRequest<R> {
  enhance(options: { headers: Record<string, string> }): R;
}
