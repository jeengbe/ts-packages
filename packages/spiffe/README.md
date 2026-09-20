<h1 align="center">@jeengbe/spiffe</h1>
<div align="center">

SPIFFE Workload API client for Node.js, Deno, and Bun. Fetch and validate JWT-SVIDs from SPIRE, with caching and retries.

[![License](https://img.shields.io/npm/l/@jeengbe/spiffe)](https://github.com/jeengbe/ts-packages/blob/master/packages/spiffe/LICENSE)
[![Version](https://img.shields.io/npm/v/@jeengbe/spiffe)](https://www.npmjs.com/package/@jeengbe/spiffe)
[![JSR](https://jsr.io/badges/@jeengbe/spiffe)](https://jsr.io/@jeengbe/spiffe)
[![Coverage](https://codecov.io/gh/jeengbe/ts-packages/branch/master/graph/badge.svg?component=spiffe)](https://app.codecov.io/gh/jeengbe/ts-packages/tree/master/packages/spiffe)

</div>

`@jeengbe/spiffe` is a SPIFFE SDK for TypeScript and JavaScript. It speaks with the [SPIFFE Workload API](https://spiffe.io/docs/latest/spiffe-about/spiffe-concepts/#spiffe-workload-api) exposed by a [SPIRE](https://spiffe.io/docs/latest/spire-about/) agent.

- **Fetch JWT-SVIDs** for a given audience, with automatic caching and request deduplication.
- **Validate incoming JWT-SVIDs** on the server, with a bounded LRU cache that never outlives a token's `exp`.
- **Retry with exponential backoff** while the SPIRE agent socket isn't ready or the workload isn't registered yet.
- **KafkaJS integration**: SASL `OAuthBearer` authentication and Confluent Schema Registry auth, driven by SPIFFE identity.
- **Runs on Node.js, Deno, and Bun.** Fully typed, `AsyncDisposable`, zero configuration in a standard SPIRE deployment.

Listed as the TypeScript/JavaScript library on
[spiffe.io](https://spiffe.io/docs/latest/deploying/libraries/).

## Installation

The package is published to [npm](https://www.npmjs.com/package/@jeengbe/spiffe) and [JSR](https://jsr.io/@jeengbe/spiffe) as `@jeengbe/spiffe`. Versions follow Semantic Versioning.

```bash
npm install @jeengbe/spiffe
```

```bash
pnpm add @jeengbe/spiffe
yarn add @jeengbe/spiffe
bun add @jeengbe/spiffe
deno add jsr:@jeengbe/spiffe
```

## Quick Start

A Node.js service that authenticates its outgoing calls with a SPIFFE JWT-SVID:

```ts
import { SpiffeClient } from '@jeengbe/spiffe';

await using spiffe = new SpiffeClient();

const token = await spiffe.getJwt('orders-api');

const res = await fetch('https://orders-api.internal/orders', {
  headers: { authorization: `Bearer ${token}` },
});
```

This assumes a SPIRE agent is running on the node and its Workload API socket is reachable by the workload. See [Connecting to the Workload API](#connecting-to-the-workload-api) for how the socket is resolved.

## Usage

### Connecting to the Workload API

The client connects to the SPIFFE Workload API over gRPC. If no socket is provided, the client will attempt to connect to `process.env.SPIFFE_ENDPOINT_SOCKET`, or fall back to `unix:///tmp/spire-agent/public/api.sock`.

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

Both forms accept an optional `SpiffeClientRetryOptions` as the last argument, to configure retries while fetching SVIDs (e.g. while the SPIRE agent socket isn't ready yet, or the workload isn't yet registered):

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

### Fetching a JWT-SVID

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

Both `getJwt()` and `getJwtSvid()` accept an optional `hint` parameter to select a specific SVID when the agent issues more than one:

```ts
const token = await spiffe.getJwt('orders-api', 'public');
```

### Validating a JWT-SVID

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

### Caching and Rotation

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

The `@jeengbe/spiffe/kafkajs` entry point provides helpers for authenticating KafkaJS clients using SPIFFE JWT-SVIDs, so a Node.js producer or consumer authenticates to Kafka with its workload identity instead of a static secret.

### Kafka SASL Authentication With SPIFFE

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

### Confluent Schema Registry SPIFFE Authentication

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

## X509-SVIDs/mTLS

The library currently only provides higher-level methods for JWT-SVIDs. If you need X509-SVID support, you can directly use the `api` property on a `SpiffeClient` to access the raw gRPC API. Please open an issue with your use case on GitHub, so we can together model a proper abstraction.

## License

[MIT](LICENSE) Jesper Engberg
