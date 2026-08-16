import { env } from './env.js';
import type { ValidationFailure } from './validation.js';
import { Either } from '@jeengbe/prelude';
import { assertType, describe, expect, it, vitest } from 'vitest';

describe('env.string', () => {
  it('returns the value when present', () => {
    const node = env.string('FOO');

    expect(node.validate(() => 'bar', '$').get()).toBe('bar');
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.string('FOO');

    expect(node.validate(() => undefined, '$').getLeft()).toEqual<ValidationFailure>({
      errors: [{ path: '$', key: 'FOO', message: 'required', value: undefined }],
    });
  });

  it('falls back to the default value when missing', () => {
    const node = env.string('FOO', 'default');

    expect(node.validate(() => undefined, '$').get()).toBe('default');
  });

  it('preserves empty string', () => {
    const node = env.string('FOO').optional();

    expect(node.validate(() => '', '$').get()).toBe('');
  });

  it('reads the raw value from the environment via the node key', () => {
    const node = env.string('FOO');

    expect(node.validate((key) => (key === 'FOO' ? 'bar' : undefined), '$').get()).toBe('bar');
  });

  it('types the result as string', () => {
    const node = env.string('FOO');

    assertType<string>(node.validate(() => 'bar', '$').get()!);
  });
});

describe('env.number', () => {
  it('parses integers', () => {
    const node = env.number('FOO');

    expect(node.validate(() => '42', '$').get()).toBe(42);
  });

  it('parses negative integers', () => {
    const node = env.number('FOO');

    expect(node.validate(() => '-42', '$').get()).toBe(-42);
  });

  it('parses decimals', () => {
    const node = env.number('FOO');

    expect(node.validate(() => '4.2', '$').get()).toBe(4.2);
  });

  it('parses negative decimals', () => {
    const node = env.number('FOO');

    expect(node.validate(() => '-4.2', '$').get()).toBe(-4.2);
  });

  it('rejects a trailing dot with no fractional digits', () => {
    const node = env.number('FOO');

    expect(node.validate(() => '4.', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [{ path: '$', key: 'FOO', message: 'invalid number', value: '4.' }],
    });
  });

  it('rejects non-numeric strings', () => {
    const node = env.number('FOO');

    expect(node.validate(() => 'not-a-number', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [{ path: '$', key: 'FOO', message: 'invalid number', value: 'not-a-number' }],
    });
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.number('FOO');

    expect(node.validate(() => undefined, '$').getLeft()).toEqual<ValidationFailure>({
      errors: [{ path: '$', key: 'FOO', message: 'required', value: undefined }],
    });
  });

  it('falls back to the default value when missing', () => {
    const node = env.number('FOO', 7);

    expect(node.validate(() => undefined, '$').get()).toBe(7);
  });

  it('respects a default value of 0', () => {
    const node = env.number('FOO', 0);

    expect(node.validate(() => undefined, '$').get()).toBe(0);
  });

  it('allows missing optional values', () => {
    const node = env.number('FOO', 7).optional();

    expect(node.validate(() => undefined, '$').get()).toBeUndefined();
  });

  it('fails on empty string', () => {
    const node = env.number('FOO', 7).optional();

    expect(node.validate(() => '', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [{ path: '$', key: 'FOO', message: 'invalid number', value: '' }],
    });
  });

  it('reads the raw value from the environment via the node key', () => {
    const node = env.number('FOO');

    expect(node.validate((key) => (key === 'FOO' ? '42' : undefined), '$').get()).toBe(42);
  });

  it('types the result as number', () => {
    const node = env.number('FOO');

    assertType<number>(node.validate(() => '42', '$').get()!);
  });
});

describe('env.boolean', () => {
  it('parses "true"', () => {
    const node = env.boolean('FOO');

    expect(node.validate(() => 'true', '$').get()).toBe(true);
  });

  it('parses "false"', () => {
    const node = env.boolean('FOO');

    expect(node.validate(() => 'false', '$').get()).toBe(false);
  });

  it('is case-insensitive', () => {
    const node = env.boolean('FOO');

    expect(node.validate(() => 'True', '$').get()).toBe(true);
  });

  it('rejects arbitrary strings', () => {
    const node = env.boolean('FOO');

    expect(node.validate(() => 'yes', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$',
          key: 'FOO',
          message: 'invalid boolean',
          formatHint: "must be 'true' or 'false'",
          value: 'yes',
        },
      ],
    });
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.boolean('FOO');

    expect(node.validate(() => undefined, '$').getLeft()).toEqual<ValidationFailure>({
      errors: [{ path: '$', key: 'FOO', message: 'required', value: undefined }],
    });
  });

  it('falls back to the default value when missing', () => {
    const node = env.boolean('FOO', true);

    expect(node.validate(() => undefined, '$').get()).toBe(true);
  });

  it('respects a default value of false', () => {
    const node = env.boolean('FOO', false);

    expect(node.validate(() => undefined, '$').get()).toBe(false);
  });

  it('allows missing optional values', () => {
    const node = env.boolean('FOO', true).optional();

    expect(node.validate(() => undefined, '$').get()).toBeUndefined();
  });

  it('fails on empty string', () => {
    const node = env.boolean('FOO', true).optional();

    expect(node.validate(() => '', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$',
          key: 'FOO',
          message: 'invalid boolean',
          formatHint: "must be 'true' or 'false'",
          value: '',
        },
      ],
    });
  });

  it('reads the raw value from the environment via the node key', () => {
    const node = env.boolean('FOO');

    expect(node.validate((key) => (key === 'FOO' ? 'true' : undefined), '$').get()).toBe(true);
  });
});

describe('env.enum', () => {
  it('accepts a listed value', () => {
    const node = env.enum('FOO', ['a', 'b', 'c']);

    expect(node.validate(() => 'b', '$').get()).toBe('b');
  });

  it('rejects an unlisted value', () => {
    const node = env.enum('FOO', ['a', 'b', 'c']);

    expect(node.validate(() => 'z', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$',
          key: 'FOO',
          message: 'invalid enum value',
          formatHint: "must be one of: 'a', 'b', 'c'",
          value: 'z',
        },
      ],
    });
  });

  it('is case-sensitive', () => {
    const node = env.enum('FOO', ['a', 'b', 'c']);

    expect(node.validate(() => 'A', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$',
          key: 'FOO',
          message: 'invalid enum value',
          formatHint: "must be one of: 'a', 'b', 'c'",
          value: 'A',
        },
      ],
    });
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.enum('FOO', ['a', 'b', 'c']);

    expect(node.validate(() => undefined, '$').getLeft()).toEqual<ValidationFailure>({
      errors: [{ path: '$', key: 'FOO', message: 'required', value: undefined }],
    });
  });

  it('falls back to the default value when missing', () => {
    const node = env.enum('FOO', ['a', 'b', 'c'], 'b');

    expect(node.validate(() => undefined, '$').get()).toBe('b');
  });

  it('allows missing optional values', () => {
    const node = env.enum('FOO', ['a', 'b', 'c'], 'b').optional();

    expect(node.validate(() => undefined, '$').get()).toBeUndefined();
  });

  it('fails on empty string', () => {
    const node = env.enum('FOO', ['a', 'b', 'c'], 'b').optional();

    expect(node.validate(() => '', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$',
          key: 'FOO',
          message: 'invalid enum value',
          formatHint: "must be one of: 'a', 'b', 'c'",
          value: '',
        },
      ],
    });
  });

  it('reads the raw value from the environment via the node key', () => {
    const node = env.enum('FOO', ['a', 'b', 'c']);

    expect(node.validate((key) => (key === 'FOO' ? 'b' : undefined), '$').get()).toBe('b');
  });

  it('types the result as the enum value type', () => {
    const node = env.enum('FOO', ['a', 'b', 'c']);

    assertType<'a' | 'b' | 'c'>(node.validate(() => 'b', '$').get()!);
  });
});

describe('env.scalar', () => {
  it('uses the transformed value when defined', () => {
    const node = env.scalar('FOO', (value) => Either.right(value.toUpperCase()));

    expect(node.validate(() => 'bar', '$').get()).toBe('BAR');
  });

  it('wraps an invalid transform result with the key and path', () => {
    const node = env.scalar('FOO', (value) =>
      value === 'valid' ? Either.right(value) : Either.left('invalid value'),
    );

    expect(node.validate(() => 'invalid', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$',
          key: 'FOO',
          message: 'invalid value',
          value: 'invalid',
        },
      ],
    });
  });

  it('passes through a ValidationFailure from the transform', () => {
    const node = env.scalar('FOO', (value, path) =>
      value === 'valid'
        ? Either.right(value)
        : Either.left({
            errors: [{ path, key: "FOO but it'a a bit extra", message: 'invalid value', value }],
          }),
    );

    expect(node.validate(() => 'invalid', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$',
          key: "FOO but it'a a bit extra",
          message: 'invalid value',
          value: 'invalid',
        },
      ],
    });
  });

  it('can transform into a non-string type', () => {
    const node = env.scalar('FOO', (value) => Either.right(value.split(';')));

    expect(node.validate(() => 'a;b;c', '$').get()).toEqual(['a', 'b', 'c']);
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.scalar('FOO', Either.right);

    expect(node.validate(() => undefined, '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$',
          key: 'FOO',
          message: 'required',
          value: undefined,
        },
      ],
    });
  });

  it('falls back to the default value when missing', () => {
    const node = env.scalar('FOO', Either.right, 'default');

    expect(node.validate(() => undefined, '$').get()).toBe('default');
  });

  it('allows missing optional values', () => {
    const node = env.scalar('FOO', Either.right, 'default').optional();

    expect(node.validate(() => undefined, '$').get()).toBeUndefined();
  });

  it('does not invoke the transform when missing and a default is used', () => {
    const transform = vitest.fn<typeof Either.right>(Either.right);
    const node = env.scalar('FOO', transform, 'default');

    node.validate(() => undefined, '$');

    expect(transform).not.toHaveBeenCalled();
  });

  it('reads the raw value from the environment via the node key', () => {
    const node = env.scalar('FOO', Either.right);

    expect(node.validate((key) => (key === 'FOO' ? 'bar' : undefined), '$').get()).toBe('bar');
  });

  it("types the result as the transform's return type", () => {
    const node = env.scalar('FOO', (value) => Either.right(value.split(';')));

    assertType<readonly string[]>(node.validate(() => 'a;b;c', '$').get()!);
  });
});

describe('env.array', () => {
  it('splits and parses each comma-separated item', () => {
    const node = env.array(env.number('FOO'));

    expect(node.validate(() => '1,2,3', '$').get()).toEqual([1, 2, 3]);
  });

  it('trims whitespace around items', () => {
    const node = env.array(env.string('FOO'));

    expect(node.validate(() => ' a , b ,c ', '$').get()).toEqual(['a', 'b', 'c']);
  });

  it('treats a single item without commas as a one-element array', () => {
    const node = env.array(env.number('FOO'));

    expect(node.validate(() => '1', '$').get()).toEqual([1]);
  });

  it('treats an empty string as empty array', () => {
    const node = env.array(env.number('FOO'));

    expect(node.validate(() => '', '$').get()).toEqual([]);
  });

  it('collects an error for every invalid item', () => {
    const node = env.array(env.number('FOO'));

    expect(node.validate(() => '1,x,3,y', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$.1',
          key: 'FOO',
          message: 'invalid number',
          value: 'x',
        },
        {
          path: '$.3',
          key: 'FOO',
          message: 'invalid number',
          value: 'y',
        },
      ],
    });
  });

  it('treats an empty item between commas as undefined for the item schema', () => {
    const node = env.array(env.number('FOO').optional());

    expect(node.validate(() => '1,,3', '$').get()).toEqual([1, undefined, 3]);
  });

  it('fails a required item schema on an empty item between commas', () => {
    const node = env.array(env.number('FOO'));

    expect(node.validate(() => '1,,3', '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$.1',
          key: 'FOO',
          message: 'required',
          value: undefined,
        },
      ],
    });
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.array(env.number('FOO'));

    expect(node.validate(() => undefined, '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$',
          key: 'FOO',
          message: 'required',
          value: undefined,
        },
      ],
    });
  });

  it('falls back to the default value when missing', () => {
    const node = env.array(env.number('FOO'), [9, 9]);

    expect(node.validate(() => undefined, '$').get()).toEqual([9, 9]);
  });

  it('does not apply the item schema default value to a fully-missing array', () => {
    const node = env.array(env.number('FOO', 5));

    expect(node.validate(() => undefined, '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$',
          key: 'FOO',
          message: 'required',
          value: undefined,
        },
      ],
    });
  });

  it('types the result as a readonly array of the item type', () => {
    const node = env.array(env.number('FOO'));

    assertType<readonly number[]>(node.validate(() => '1,2,3', '$').get()!);
  });

  it('correctly types the result as a readonly array of the item type when the item schema is optional', () => {
    const node = env.array(env.number('FOO').optional());

    assertType<readonly (number | undefined)[]>(node.validate(() => '1,,3', '$').get()!);
  });
});

describe('env.discriminate', () => {
  const spec = env.discriminate('type', env.enum('TYPE', ['a', 'b', 'c']), {
    a: { value: env.string('A_VALUE') },
    b: { value: env.number('B_VALUE'), value2: env.number('B_VALUE_2').optional() },
  });

  it('loads the fields for the matching discriminator branch', () => {
    const values: Record<string, string> = { TYPE: 'a', A_VALUE: 'hello' };

    expect(spec.validate((key) => values[key], '$').get()).toEqual({ type: 'a', value: 'hello' });
  });

  it('loads a different branch based on the discriminator', () => {
    const values: Record<string, string> = { TYPE: 'b', B_VALUE: '42' };

    expect(spec.validate((key) => values[key], '$').get()).toEqual({
      type: 'b',
      value: 42,
      value2: undefined,
    });
  });

  it('does not read fields from a non-matching branch', () => {
    const values: Record<string, string> = {
      TYPE: 'a',
      A_VALUE: 'hello',
      B_VALUE: 'not-a-number',
    };

    expect(spec.validate((key) => values[key], '$').get()).toEqual({ type: 'a', value: 'hello' });
  });

  it('fails when the discriminator value itself is invalid', () => {
    const values: Record<string, string> = { TYPE: 'z' };

    expect(spec.validate((key) => values[key], '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$.type',
          key: 'TYPE',
          message: 'invalid enum value',
          formatHint: "must be one of: 'a', 'b', 'c'",
          value: 'z',
        },
      ],
    });
  });

  it('fails when the matching branch has an invalid field', () => {
    const values: Record<string, string> = {
      TYPE: 'b',
      B_VALUE: 'not-a-number',
      B_VALUE_2: 'also-not-a-number',
    };

    expect(spec.validate((key) => values[key], '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$.value',
          key: 'B_VALUE',
          message: 'invalid number',
          value: 'not-a-number',
        },
        {
          path: '$.value2',
          key: 'B_VALUE_2',
          message: 'invalid number',
          value: 'also-not-a-number',
        },
      ],
    });
  });

  it('returns just the discriminator key when the value has no mapping entry', () => {
    const values: Record<string, string> = { TYPE: 'c' };

    expect(spec.validate((key) => values[key], '$').get()).toEqual({
      type: 'c',
    });
  });

  it('allows a transformer to return a ValidationFailure on the discriminator itself', () => {
    const spec = env
      .discriminate('type', env.enum('TYPE', ['a', 'b', 'c']), {
        a: { value: env.string('A_VALUE') },
        b: { value: env.number('B_VALUE'), value2: env.number('B_VALUE_2').optional() },
      })
      .transform((value, path) => {
        if (value.type === 'a' && value.value === 'invalid') {
          return Either.left({
            errors: [
              {
                path: `${path}.type`,
                key: 'TYPE',
                message: 'invalid value for type a',
                value: value.value,
              },
            ],
          });
        }

        return Either.right(value);
      });

    const values: Record<string, string> = { TYPE: 'a', A_VALUE: 'invalid' };

    expect(spec.validate((key) => values[key], '$').getLeft()).toEqual<ValidationFailure>({
      errors: [
        {
          path: '$.type',
          key: 'TYPE',
          message: 'invalid value for type a',
          value: 'invalid',
        },
      ],
    });
  });

  it('types the result as a discriminated union', () => {
    assertType<
      | {
          type: 'a';
          value: string;
        }
      | {
          type: 'b';
          value: number;
          value2: number | undefined;
        }
      | {
          type: 'c';
        }
    >(spec.validate(() => undefined, '$').get()!);
  });
});

describe('env.parse', () => {
  it('loads a flat spec into a plain object', () => {
    const result = env.parse(
      {
        foo: env.string('FOO'),
        num: env.number('NUM'),
      },
      {
        FOO: 'hello',
        NUM: '42',
      },
    );

    expect(result.get()).toEqual({ foo: 'hello', num: 42 });
  });

  it('loads a single top-level node without wrapping it in an object', () => {
    expect(env.parse(env.string('FOO'), { FOO: 'hello' }).get()).toBe('hello');
  });

  it('supports nested object specs', () => {
    const result = env.parse(
      {
        nested: {
          foo: env.string('FOO'),
          num: env.number('NUM'),
        },
      },
      {
        FOO: 'hello',
        NUM: '42',
      },
    );

    expect(result.get()).toEqual({ nested: { foo: 'hello', num: 42 } });
  });

  it('trims surrounding whitespace from env values', () => {
    expect(
      env
        .parse(
          {
            foo: env.string('FOO'),
          },
          {
            FOO: '  hello  ',
          },
        )
        .get(),
    ).toEqual({ foo: 'hello' });
  });

  it('returns the error for a missing required value', () => {
    expect(
      env
        .parse(env.string('FOO'), {
          FOO: undefined,
        })
        .getLeft(),
    ).toEqual<ValidationFailure>({
      errors: [{ path: '$', key: 'FOO', message: 'required', value: undefined }],
    });
  });

  it('combines errors from multiple failing keys', () => {
    expect(
      env
        .parse(
          {
            foo: env.string('FOO'),
            num: env.number('NUM'),
          },
          {
            FOO: undefined,
            NUM: 'not-a-number',
          },
        )
        .getLeft(),
    ).toEqual<ValidationFailure>({
      errors: [
        { path: '$.foo', key: 'FOO', message: 'required', value: undefined },
        { path: '$.num', key: 'NUM', message: 'invalid number', value: 'not-a-number' },
      ],
    });
  });

  it('applies default values for keys missing from process.env', () => {
    const result = env.parse(
      {
        foo: env.string('FOO', 'default-foo'),
        flag: env.boolean('FLAG', false),
      },
      {
        FOO: undefined,
        FLAG: undefined,
      },
    );

    expect(result.get()).toEqual({ foo: 'default-foo', flag: false });
  });

  it('actually reads from process.env', () => {
    vitest.stubEnv('FOO', 'hello');

    const result = env.parse(env.string('FOO'));

    expect(result.get()).toBe('hello');

    vitest.unstubAllEnvs();
  });

  it("types the result as the spec's return type", () => {
    vitest.stubEnv('FOO', 'hello');

    {
      const result = env.parse(env.string('FOO')).get()!;

      assertType<string>(result);
    }
    {
      const result = env
        .parse({
          foo: env.string('FOO'),
        })
        .get()!;

      assertType<{ foo: string }>(result);
    }
  });
});

describe('env.load', () => {
  it('loads a spec and throws on validation failure', () => {
    expect(() =>
      env.load(
        {
          foo: env.string('FOO'),
          num: env.number('NUM'),
        },
        {
          FOO: undefined,
          NUM: 'not-a-number',
        },
      ),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Error: Environment validation failed:
        $.foo (FOO): required (got: '<not provided>')
        $.num (NUM): invalid number (got: 'not-a-number')]
    `);
  });

  it('loads a spec and returns the parsed values', () => {
    const result = env.load(
      {
        foo: env.string('FOO'),
        num: env.number('NUM'),
      },
      {
        FOO: 'hello',
        NUM: '42',
      },
    );

    expect(result).toEqual({ foo: 'hello', num: 42 });
  });

  const appConfigSchema = {
    server: {
      env: env.enum('NODE_ENV', ['development', 'staging', 'production'], 'development'),
      port: env.number('PORT', 3000),
      host: env.string('HOST', 'localhost'),
      corsOrigins: env.array(env.string('CORS_ORIGINS')).optional(),
    },
    database: env.discriminate('provider', env.enum('DB_PROVIDER', ['postgres', 'sqlite']), {
      postgres: {
        url: env.string('DATABASE_URL'),
        poolSize: env.number('DB_POOL_SIZE', 10),
        ssl: env.boolean('DB_SSL', true),
      },
      sqlite: {
        filePath: env.string('DB_FILE_PATH', ':memory:'),
        journalMode: env.enum('DB_JOURNAL_MODE', ['delete', 'wal'], 'wal'),
      },
    }),
    features: {
      flags: env.array(env.enum('FEATURE_FLAGS', ['beta_ui', 'new_billing', 'mfa'])),
      rateLimit: env.number('RATE_LIMIT_MAX', 100),
      maintenanceMode: env.boolean('MAINTENANCE_MODE', false),
    },
    auth: env
      .scalar('AUTH_CONFIG', (value) => {
        try {
          const parsed = JSON.parse(value);

          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'secret' in parsed &&
            typeof parsed.secret === 'string' &&
            'expiresIn' in parsed &&
            typeof parsed.expiresIn === 'number'
          ) {
            return Either.right(parsed as { secret: string; expiresIn: number });
          }

          return Either.left('missing required fields in JSON payload');
        } catch {
          return Either.left('invalid JSON payload');
        }
      })
      .optional(),
  };

  it('successfully parses and infers types for a fully populated nested environment', () => {
    const result = env.load(appConfigSchema, {
      NODE_ENV: 'production',
      PORT: '8080',
      HOST: '0.0.0.0',
      CORS_ORIGINS: 'https://example.com, https://api.example.com',
      DB_PROVIDER: 'postgres',
      DATABASE_URL: 'postgres://user:pass@db:5432/main',
      DB_POOL_SIZE: '25',
      DB_SSL: 'true',
      FEATURE_FLAGS: 'beta_ui,mfa',
      MAINTENANCE_MODE: 'false',
      AUTH_CONFIG: '{"secret":"super-secret-key","expiresIn":3600}',
    });

    expect(result).toEqual({
      server: {
        env: 'production',
        port: 8080,
        host: '0.0.0.0',
        corsOrigins: ['https://example.com', 'https://api.example.com'],
      },
      database: {
        provider: 'postgres',
        url: 'postgres://user:pass@db:5432/main',
        poolSize: 25,
        ssl: true,
      },
      features: {
        flags: ['beta_ui', 'mfa'],
        rateLimit: 100, // Used default
        maintenanceMode: false,
      },
      auth: {
        secret: 'super-secret-key',
        expiresIn: 3600,
      },
    });
  });

  it('correctly loads default values and unpopulated optionals', () => {
    const result = env.load(appConfigSchema, {
      DB_PROVIDER: 'sqlite',
      FEATURE_FLAGS: '',
    });

    expect(result).toEqual({
      server: {
        env: 'development',
        port: 3000,
        host: 'localhost',
        corsOrigins: undefined,
      },
      database: {
        provider: 'sqlite',
        filePath: ':memory:',
        journalMode: 'wal',
      },
      features: {
        flags: [],
        rateLimit: 100,
        maintenanceMode: false,
      },
      auth: undefined,
    });

    assertType<{
      server: {
        env: 'development' | 'staging' | 'production';
        port: number;
        host: string;
        corsOrigins?: readonly string[] | undefined;
      };
      database:
        | {
            provider: 'postgres';
            url: string;
            poolSize: number;
            ssl: boolean;
          }
        | {
            provider: 'sqlite';
            filePath: string;
            journalMode: 'delete' | 'wal';
          };
      features: {
        flags: readonly ('beta_ui' | 'new_billing' | 'mfa')[];
        rateLimit: number;
        maintenanceMode: boolean;
      };
      auth?:
        | {
            secret: string;
            expiresIn: number;
          }
        | undefined;
    }>(result);
  });

  it('aggregates multiple validation errors across deep properties', () => {
    expect(() =>
      env.load(appConfigSchema, {
        NODE_ENV: 'invalid_env',
        DB_PROVIDER: 'postgres',
        DATABASE_URL: undefined, // Missing required
        DB_POOL_SIZE: 'not-a-number',
        FEATURE_FLAGS: 'beta_ui,unknown_flag',
        AUTH_CONFIG: '{"secret":"missing-expires-in"}',
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Error: Environment validation failed:
        $.server.env (NODE_ENV): invalid enum value (must be one of: 'development', 'staging', 'production'; got: 'invalid_env')
        $.database.url (DATABASE_URL): required (got: '<not provided>')
        $.database.poolSize (DB_POOL_SIZE): invalid number (got: 'not-a-number')
        $.features.flags.1 (FEATURE_FLAGS): invalid enum value (must be one of: 'beta_ui', 'new_billing', 'mfa'; got: 'unknown_flag')
        $.auth (AUTH_CONFIG): missing required fields in JSON payload (got: '{"secret":"missing-expires-in"}')]
    `);
  });
});
