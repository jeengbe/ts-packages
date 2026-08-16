<h1 align="center">@jeengbe/config</h1>
<div align="center">

A declarative, strongly typed schema for parsing and validating environment variables in TypeScript.

[![License](https://img.shields.io/npm/l/@jeengbe/config)](https://github.com/jeengbe/ts-packages/blob/master/packages/config/LICENSE)
[![Version](https://img.shields.io/npm/v/@jeengbe/config)](https://www.npmjs.com/package/@jeengbe/config)
[![JSR](https://jsr.io/badges/@jeengbe/config)](https://jsr.io/@jeengbe/config)
[![Coverage](https://codecov.io/gh/jeengbe/ts-packages/branch/master/graph/badge.svg?component=config)](https://app.codecov.io/gh/jeengbe/ts-packages/tree/master/packages/config)

</div>

Define your environment variables once as a schema, and get back a plain, fully typed config object. Missing or invalid values are collected across the whole schema and reported together, so you find out about every misconfigured variable at once, rather than one crash at a time.

## Installation

The package is published to [npm](https://www.npmjs.com/package/@jeengbe/config) and [JSR](https://jsr.io/@jeengbe/config) as `@jeengbe/config`. Versions follow Semantic Versioning.

## Usage

### Defining and loading a schema

```ts
import { env } from '@jeengbe/config';

const config = env.load({
  port: env.number('PORT', 3000),
  host: env.string('HOST', '0.0.0.0'),
  logLevel: env.enum('LOG_LEVEL', ['debug', 'info', 'warn', 'error'], 'info'),
});
// config: { port: number; host: string; logLevel: 'debug' | 'info' | 'warn' | 'error' }
```

`env.load` reads from `process.env` (values are trimmed, and a missing or whitespace-only value is treated as absent), validates every field, and returns a plain object typed to match the schema. If anything is missing or invalid, it throws a single error combining every failure:

```
Failed to load config: FOO ($.foo): required, NUM ($.num): invalid number
```

Schemas nest using plain objects:

```ts
const config = env.load({
  server: {
    port: env.number('PORT', 3000),
  },
  database: {
    url: env.string('DATABASE_URL'),
  },
});
// config: { server: { port: number }; database: { url: string } }
```

### Scalars

- `env.string(key, defaultValue?)`
- `env.number(key, defaultValue?)` — accepts integers and decimals, including negative numbers.
- `env.boolean(key, defaultValue?)` — accepts `'true'`/`'false'`, case-insensitively.
- `env.enum(key, values, defaultValue?)` — restricts the value to one of a fixed list, typed as a literal union of `values`.

Without a `defaultValue`, all of these are required and fail validation when the variable is missing.

### Custom scalars (`env.custom`)

For anything else, write your own parser with `env.custom`. It returns a `ValidationResult<T>` (an `Either<readonly string[], T>` from `@jeengbe/prelude`):

```ts
import { env } from '@jeengbe/config';
import { Either } from '@jeengbe/prelude';

const apiUrl = env.custom('API_URL', (value) => {
  try {
    return Either.right(new URL(value));
  } catch {
    return Either.left(['must be a valid URL']);
  }
});
```

### Optional values (`.optional()`)

Any scalar node can be made optional. This resolves to `undefined` when the variable is missing, ignoring the default value on the underlying node, instead of failing validation:

```ts
const timeoutMs = env.number('TIMEOUT_MS').optional();
```

### Transforming values (`.transform()`)

Every node can be transformed into a different value. The transform function receives the already-validated value and itself returns a `ValidationResult`, so it can also fail validation:

```ts
const port = env
  .number('PORT')
  .transform((n) =>
    n > 0 && n < 65536 ? Either.right(n) : Either.left(['must be between 1 and 65535']),
  );
```

### Arrays (`env.array`)

`env.array` splits a comma-separated string and validates each item against a scalar node:

```ts
const ports = env.array(env.number('PORTS'));
// PORTS="3000,3001,3002" -> [3000, 3001, 3002]
```

An empty item between commas (e.g. `"1,,3"`) is treated as `undefined` for the item schema (mark the item node `.optional()` to allow that). A missing variable falls back to the array's own `defaultValue`, if one was given; the item schema's default is not applied per-missing-item.

### Discriminated variants (`env.discriminate`)

Use `env.discriminate` to pick between several shapes based on the value of another variable, similar to a discriminated union:

```ts
const storage = env.discriminate('type', env.enum('STORAGE_TYPE', ['s3', 'local']), {
  s3: { bucket: env.string('S3_BUCKET') },
  local: { path: env.string('LOCAL_PATH') },
});
// storage: { type: 's3'; bucket: string } | { type: 'local'; path: string }
```

### Feature flags (`ifEnabled`)

`ifEnabled` wraps `env.discriminate` for the common case of gating a block of config behind a boolean flag:

```ts
import { ifEnabled } from '@jeengbe/config';

const feature = ifEnabled('FEATURE_ENABLED', {
  apiKey: env.string('FEATURE_API_KEY'),
});
// feature: { enabled: true; apiKey: string } | { enabled: false }
```

This resolves to `{ enabled: true, apiKey: string }` when `FEATURE_ENABLED` is `'true'`, or `{ enabled: false }` otherwise.
