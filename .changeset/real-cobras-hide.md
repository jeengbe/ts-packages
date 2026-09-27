---
"@jeengbe/spiffe": major
---

refactor!: rework internals

**Breaking changes**

- `SpiffeClient` now takes a single `SpiffeClientOptions` object. Pass the socket or transport as `connection` and retry options as `retry`:

  ```diff
  - new SpiffeClient('unix:///path/to/api.sock', { maxAttempts: 3 });
  + new SpiffeClient({ connection: 'unix:///path/to/api.sock', retry: { maxAttempts: 3 } });
  ```

- `getJwt()`, `getJwtSvid()`, `createKafkajsSaslMechanism()`, and `createKafkajsAuthMiddleware()` take an `SvidFilter` instead of a `hint` string:

  ```diff
  - spiffe.getJwt('orders-api', 'public');
  + spiffe.getJwt('orders-api', { hint: 'public' });
  ```

- `getJwtSvid()` returns `null` instead of throwing `NoSvidError` when the workload has no SVID. `getJwt()` still throws.
- `ParsedJwtSvid` was removed. `getJwtSvid()` returns `JwtSvid`, which now includes `hint` and `expiresAtMs`.
- `NoSvidError` takes the `SvidFilter` that was used, exposed as `filter`, instead of an SVID type and hint.

**Features**

- Filter SVIDs by SPIFFE ID with `{ spiffeId }`.
- Pass custom caches via `jwtSvidCache` and `validatedJwtCache`, either a configured `SpiffeCacheImpl` or your own `SpiffeCache` implementation.
- Disable retries with `retry.enabled: false`.

**Fixes**

- `validateJwt()` now retries while the Workload API is unavailable.
- Fetched JWT-SVIDs are cached for at most 60 seconds and 1,000 entries.
- `close()` now closes the connection the client opened itself. A transport passed in by the caller is left open.
- Removed the `lru-cache` dependency.
