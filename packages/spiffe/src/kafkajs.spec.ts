import { FakeSpiffeClient } from './client/fake.js';
import { createKafkajsAuthMiddleware, createKafkajsSaslMechanism } from './kafkajs.js';
import type { Middleware, Request } from 'mappersmith';
import { requestFactory } from 'mappersmith/test';
import { beforeEach, describe, expect, it } from 'vitest';

describe('createKafkajsSaslMechanism', () => {
  let spiffe: FakeSpiffeClient;

  beforeEach(() => {
    spiffe = new FakeSpiffeClient();
  });

  it('provides the fetched JWT as the oauthbearer value', async () => {
    spiffe.getJwt.mockResolvedValueOnce('the-jwt');

    const sasl = createKafkajsSaslMechanism('kafka-cluster', undefined, undefined, spiffe);

    const result = await sasl.oauthBearerProvider();

    expect(spiffe.getJwt).toHaveBeenCalledWith('kafka-cluster', undefined);
    expect(result).toMatchObject({ value: 'the-jwt' });
  });

  it('includes the given SASL extensions and hint', async () => {
    spiffe.getJwt.mockResolvedValueOnce('the-jwt');

    const sasl = createKafkajsSaslMechanism(
      'kafka-cluster',
      { logicalCluster: 'lkc-abc123' },
      'my-hint',
      spiffe,
    );

    const result = await sasl.oauthBearerProvider();

    expect(spiffe.getJwt).toHaveBeenCalledWith('kafka-cluster', 'my-hint');
    expect(result).toEqual({ value: 'the-jwt', extensions: { logicalCluster: 'lkc-abc123' } });
  });
});

describe('createKafkajsAuthMiddleware', () => {
  let spiffe: FakeSpiffeClient;

  beforeEach(() => {
    spiffe = new FakeSpiffeClient();
  });

  it('adds an Authorization header with the fetched JWT', async () => {
    spiffe.getJwt.mockResolvedValueOnce('the-jwt');

    const middleware = createKafkajsAuthMiddleware('kafka-cluster', undefined, undefined, spiffe);

    const result = await runMiddleware(middleware);

    expect(spiffe.getJwt).toHaveBeenCalledWith('kafka-cluster', undefined);
    expect(result.headers()).toEqual({
      authorization: 'Bearer the-jwt',
    });
  });

  it('includes additional headers and the hint', async () => {
    spiffe.getJwt.mockResolvedValueOnce('the-jwt');

    const middleware = createKafkajsAuthMiddleware(
      'kafka-cluster',
      { 'target-sr-cluster': 'lsrc-abc123' },
      'my-hint',
      spiffe,
    );

    const result = await runMiddleware(middleware);

    expect(spiffe.getJwt).toHaveBeenCalledWith('kafka-cluster', 'my-hint');
    expect(result.headers()).toEqual({
      authorization: 'Bearer the-jwt',
      'target-sr-cluster': 'lsrc-abc123',
    });
  });
});

async function runMiddleware(middleware: Middleware): Promise<Request> {
  const descriptor = middleware({
    clientId: null,
    context: {},
    resourceMethod: 'someMethod',
    resourceName: 'someResource',
  });

  return (await descriptor.prepareRequest!(
    async () => requestFactory(),
    () => {},
  ))!;
}
