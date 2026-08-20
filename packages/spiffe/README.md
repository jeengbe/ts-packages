<h1 align="center">@jeengbe/spiffe</h1>
<div align="center">

A TypeScript library for working with SPIFFE workload identities.

[![License](https://img.shields.io/npm/l/@jeengbe/spiffe)](https://github.com/jeengbe/ts-packages/blob/master/packages/spiffe/LICENSE)
[![Version](https://img.shields.io/npm/v/@jeengbe/spiffe)](https://www.npmjs.com/package/@jeengbe/spiffe)
[![JSR](https://jsr.io/badges/@jeengbe/spiffe)](https://jsr.io/@jeengbe/spiffe)
[![Coverage](https://codecov.io/gh/jeengbe/ts-packages/branch/master/graph/badge.svg?component=spiffe)](https://app.codecov.io/gh/jeengbe/ts-packages/tree/master/packages/spiffe)

</div>

This package provides convenient helpers for integrating SPIFFE workload identities into TypeScript applications. Instead of dealing with Workload API protocol details, you can enjoy ready-to-use credentials and trust bundles.

## Installation

The package is published to [npm](https://www.npmjs.com/package/@jeengbe/spiffe) and [JSR](https://jsr.io/@jeengbe/spiffe) as `@jeengbe/spiffe`. Versions follow Semantic Versioning.

## Usage

The client connects to the Workload API over gRPC. If no socket is provided, the client will attempt to connect to `process.env.SPIFFE_ENDPOINT_SOCKET`, or fall back to `unix:///tmp/spire-agent/public/api.sock`.

```ts
const spiffe = new SpiffeClient();
```

To specify a socket explicitly:

```ts
const spiffe = new SpiffeClient('unix:///path/to/api.sock');
```

For advanced gRPC configuration (e.g. custom channel credentials), construct your own `@connectrpc/connect` `Transport` and pass it instead. Make sure to set the `workload.spiffe.io` metadata header to `'true'`, as the Workload API requires it:

```ts
import { createGrpcTransport } from '@connectrpc/connect-node';

const spiffe = new SpiffeClient(
  createGrpcTransport({
    baseUrl: 'https://spire-agent.internal:8081',
    interceptors: [
      (next) => (req) => {
        req.header.set('workload.spiffe.io', 'true');
        return next(req);
      },
    ],
  }),
);
```

Both forms accept an optional `SpiffeClientRetryOptions` as the last argument, to configure retries while fetching SVIDs (e.g. while the SPIRE agent socket isn't ready yet, or the workload isn't yet registered). `PermissionDenied` and `Unavailable` gRPC errors are retried with exponential backoff:

```ts
const spiffe = new SpiffeClient(undefined, {
  maxAttempts: 6,
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
});
```

`SpiffeClient` implements `AsyncDisposable`, so you can use `await using`:

```ts
await using spiffe = new SpiffeClient();
```

### JWT-SVIDs

`SpiffeClient` implements the `SpiffeJwtClient` interface.

Use `getJwt()` in client applications to fetch a JSON Web Token for the specified audience:

```ts
declare const spiffe: SpiffeJwtClient;

async function fetchData(url: string) {
  const token = await spiffe.getJwt('orders-api');

  return fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
}
```

Use `getJwtSvid()` instead to also get the SPIFFE ID and expiration time:

```ts
const svid = await spiffe.getJwtSvid('orders-api');
console.log(svid.spiffeId, svid.token, svid.expiresAtMs);
```

On the server, use `validateJwt()` to validate an incoming JWT-SVID bearer token. Returns `null` if the token is invalid.

```ts
declare const spiffe: SpiffeJwtClient;

async function authenticateRequest(req: Request) {
  const token = extractBearer(req.headers['Authorization']);

  const svid = await spiffe.validateJwt('orders-api', token);
  if (!svid) {
    throw new Error('Unauthorized');
  }

  return svid; // { spiffeId, claims }
}
```

Both `getJwt()` and `getJwtSvid()` accept an optional `hint` parameter to select a specific SVID when the agent issues more than one:

```ts
const token = await spiffe.getJwt('orders-api', 'my-service');
```

SVIDs are cached for half of their remaining TTL and concurrent requests for the same audience are deduplicated.

Validated tokens are cached too, so a burst of requests carrying the same bearer token only hits the Workload API once. The cache is keyed by token and expected audience, bounded in size with least-recently-used eviction, and an entry never outlives the `exp` claim of its token. Invalid tokens are never cached.

### Error handling

`getJwt()` and `getJwtSvid()` throw `NoSvidError` when the Workload API returns no SVIDs:

```ts
import { NoSvidError } from '@jeengbe/spiffe';

try {
  const token = await spiffe.getJwt('orders-api');
} catch (err) {
  if (err instanceof NoSvidError) {
    // No identity
  }
}
```

`validateJwt()` returns `null` for invalid tokens rather than throwing.

## KafkaJS Integration

The `@jeengbe/spiffe/kafkajs` entry point provides helpers for authenticating KafkaJS clients using JWT-SVIDs.

### SASL Authentication

Use `createKafkajsSaslMechanism()` to create a KafkaJS-compatible SASL `OAuthBearer` configuration. Pass it directly to the `sasl` option when constructing a `Kafka` instance:

```ts
import { createKafkajsSaslMechanism } from '@jeengbe/spiffe/kafkajs';
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  brokers: config.kafka.brokers,
  sasl: createKafkajsSaslMechanism('kafka-cluster'),
});
```

To pass SASL extensions (e.g. for Confluent Cloud logical cluster routing):

```ts
createKafkajsSaslMechanism('kafka-cluster', {
  logicalCluster: 'lkc-abc123',
  identityPoolId: 'pool-xyz',
});
```

### Schema Registry Middleware

Use `createKafkajsAuthMiddleware()` to create a [Mappersmith](https://github.com/tulios/mappersmith) middleware that attaches a SPIFFE JWT-SVID as a bearer `Authorization` token on outgoing requests:

```ts
import { createKafkajsAuthMiddleware } from '@jeengbe/spiffe/kafkajs';
import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';

const schemaRegistry = new SchemaRegistry({
  host: config.kafka.schemaRegistry.url,
  clientId: config.kafka.schemaRegistry.clientId,
  middlewares: [createKafkajsAuthMiddleware('confluent-cloud')],
});
```

To pass additional headers (e.g. for Confluent Cloud logical cluster routing):

```ts
createKafkajsAuthMiddleware('confluent-cloud', {
  'target-sr-cluster': 'lsrc-abc123',
  'identity-pool-id': 'pool-xyz',
});
```
