import { EnvNode } from './ast.js';
import { env } from './env.js';
import type { ValidationResult } from './validation.js';
import { Either } from '@jeengbe/prelude';
import { afterEach, describe, expect, it, test, vitest } from 'vitest';

testEnv(
  'env.string',
  {
    regular: env.string('FOO'),
    defaulted: env.string('FOO', 'default'),
    optional: env.string('FOO').optional(),
    defaultedOptional: env.string('FOO', 'default').optional(),
  },
  [],
);

testEnv(
  'env.number',
  {
    regular: env.number('FOO'),
    defaulted: env.number('FOO', 7),
    optional: env.number('FOO').optional(),
    defaultedOptional: env.number('FOO', 7).optional(),
  },
  [
    { name: 'integer', value: '42' },
    { name: 'negative integer', value: '-42' },
    { name: 'decimal', value: '4.2' },
    { name: 'negative decimal', value: '-4.2' },
    { name: 'trailing dot', value: '4.' },
    { name: 'number with whitespace', value: ' 42 ' },
  ],
);

testEnv(
  'env.boolean',
  {
    regular: env.boolean('FOO'),
    defaulted: env.boolean('FOO', true),
    optional: env.boolean('FOO').optional(),
    defaultedOptional: env.boolean('FOO', true).optional(),
  },
  [
    { name: 'true', value: 'true' },
    { name: 'false', value: 'false' },
    { name: 'case-insensitive true', value: 'True' },
    { name: 'case-insensitive false', value: 'FALSE' },
    { name: 'true with whitespace', value: ' true ' },
  ],
);

testEnv(
  'env.enum',
  {
    regular: env.enum('FOO', ['a', 'b', 'c']),
    defaulted: env.enum('FOO', ['a', 'b', 'c'], 'b'),
    optional: env.enum('FOO', ['a', 'b', 'c']).optional(),
    defaultedOptional: env.enum('FOO', ['a', 'b', 'c'], 'b').optional(),
  },
  [
    { name: 'listed value', value: 'b' },
    { name: 'unlisted value', value: 'z' },
    { name: 'case-sensitive listed value', value: 'A' },
    { name: 'listed value with whitespace', value: ' b ' },
  ],
);

testEnv(
  'env.array',
  {
    regular: env.array(env.number('FOO')),
    defaulted: env.array(env.number('FOO'), [9, 9]),
    optional: env.array(env.number('FOO')).optional(),
    defaultedOptional: env.array(env.number('FOO'), [9, 9]).optional(),
  },
  [
    { name: 'comma-separated numbers', value: '1,2,3' },
    { name: 'single number', value: '1' },
    { name: 'invalid items', value: '1,x,3,y' },
    { name: 'empty item between commas', value: '1,,3' },
    { name: 'values with whitespace', value: ' 1 , 2 , 3 ' },
  ],
);

testEnv(
  'env.array with optional item type',
  {
    regular: env.array(env.number('FOO').optional()),
    defaulted: env.array(env.number('FOO').optional(), [9, 9]),
    optional: env.array(env.number('FOO').optional()).optional(),
    defaultedOptional: env.array(env.number('FOO').optional(), [9, 9]).optional(),
  },
  [
    { name: 'comma-separated numbers', value: '1,2,3' },
    { name: 'single number', value: '1' },
    { name: 'invalid items', value: '1,x,3,y' },
    { name: 'empty item between commas', value: '1,,3' },
    { name: 'values with whitespace', value: ' 1 , 2 , 3 ' },
  ],
);

{
  function validate(v: string): ValidationResult<string> {
    return Either.cond(
      v === 'valid',
      () => ['bad'],
      () => v,
    );
  }

  testEnv(
    'env.scalar',
    {
      regular: env.scalar('FOO', validate),
      defaulted: env.scalar('FOO', validate, 'default'),
      optional: env.scalar('FOO', validate).optional(),
      defaultedOptional: env.scalar('FOO', validate, 'default').optional(),
    },
    [
      { name: 'valid value', value: 'valid' },
      { name: 'invalid value', value: 'invalid' },
      { name: 'valid with whitespace', value: ' valid ' },
    ],
  );
}

function testEnv(
  name: string,
  nodes: {
    regular: EnvNode<unknown>;
    defaulted: EnvNode<unknown>;
    optional: EnvNode<unknown>;
    defaultedOptional: EnvNode<unknown>;
  },
  cases: readonly { name: string; value: string }[],
) {
  describe(`${name}`, () => {
    describe.each(Object.entries(nodes))('%s', (_, node) => {
      for (const c of [
        { name: 'undefined', value: undefined },
        { name: 'empty', value: '' },
        { name: 'whitespace', value: ' ' },
        { name: 'foo', value: 'foo' },
        ...cases,
      ]) {
        test(`${c.name} value`, () => {
          const result = node.validate('$', () => c.value);

          expect(
            result.fold(
              (l) => `Left(${JSON.stringify(l)})`,
              (r) => `Right(${JSON.stringify(r)})`,
            ),
          ).toMatchSnapshot();
        });
      }
    });
  });
}

describe('env.discriminate', () => {
  const spec = env.discriminate('type', env.enum('TYPE', ['a', 'b']), {
    a: { value: env.string('A_VALUE') },
    b: { value: env.number('B_VALUE') },
  });

  it('loads the fields for the matching discriminator branch', () => {
    const values: Record<string, string> = { TYPE: 'a', A_VALUE: 'hello' };
    const result = spec.validate('$', (key) => values[key]);

    expect(result.get()).toEqual({ type: 'a', value: 'hello' });
  });

  it('loads a different branch based on the discriminator', () => {
    const values: Record<string, string> = { TYPE: 'b', B_VALUE: '42' };
    const result = spec.validate('$', (key) => values[key]);

    expect(result.get()).toEqual({ type: 'b', value: 42 });
  });

  it('does not read fields from a non-matching branch', () => {
    const values: Record<string, string> = {
      TYPE: 'a',
      A_VALUE: 'hello',
      B_VALUE: 'not-a-number',
    };
    const result = spec.validate('$', (key) => values[key]);

    expect(result.get()).toEqual({ type: 'a', value: 'hello' });
  });

  it('fails when the discriminator value itself is invalid', () => {
    const values: Record<string, string> = { TYPE: 'z' };
    const result = spec.validate('$', (key) => values[key]);

    expect(result.getLeft()).toEqual(["TYPE ($): invalid enum value (must be one of: 'a', 'b')"]);
  });

  it('fails when the matching branch has an invalid field', () => {
    const values: Record<string, string> = {
      TYPE: 'b',
      B_VALUE: 'not-a-number',
    };
    const result = spec.validate('$', (key) => values[key]);

    expect(result.getLeft()).toEqual(['B_VALUE ($.value): invalid number']);
  });

  it('returns just the discriminator key when the value has no mapping entry', () => {
    const unmapped = env.discriminate('type', env.enum('TYPE', ['a', 'b', 'c']), {
      a: { value: env.string('A_VALUE') },
    });
    const values: Record<string, string> = { TYPE: 'c' };

    expect(unmapped.validate('$', (key) => values[key]).get()).toEqual({
      type: 'c',
    });
  });
});

describe('env.load', () => {
  afterEach(() => {
    vitest.unstubAllEnvs();
  });

  it('loads a flat spec into a plain object', () => {
    vitest.stubEnv('FOO', 'hello');
    vitest.stubEnv('NUM', '42');

    const result = env.load({
      foo: env.string('FOO'),
      num: env.number('NUM'),
    });

    expect(result).toEqual({ foo: 'hello', num: 42 });
  });

  it('loads a single top-level node without wrapping it in an object', () => {
    vitest.stubEnv('FOO', 'hello');

    expect(env.load(env.string('FOO'))).toBe('hello');
  });

  it('supports nested object specs', () => {
    vitest.stubEnv('FOO', 'hello');
    vitest.stubEnv('NUM', '42');

    const result = env.load({
      nested: {
        foo: env.string('FOO'),
        num: env.number('NUM'),
      },
    });

    expect(result).toEqual({ nested: { foo: 'hello', num: 42 } });
  });

  it('trims surrounding whitespace from env values', () => {
    vitest.stubEnv('FOO', '  hello  ');

    expect(env.load({ foo: env.string('FOO') })).toEqual({ foo: 'hello' });
  });

  it('throws with a message describing a missing required value', () => {
    vitest.stubEnv('FOO', undefined);

    expect(() => env.load({ foo: env.string('FOO') })).toThrow(
      'Failed to load config: FOO ($.foo): required',
    );
  });

  it('prefixes errors with the key path for nested specs', () => {
    vitest.stubEnv('FOO', undefined);

    expect(() => env.load({ nested: { foo: env.string('FOO') } })).toThrow(
      'Failed to load config: FOO ($.nested.foo): required',
    );
  });

  it('combines errors from multiple failing keys', () => {
    vitest.stubEnv('FOO', undefined);
    vitest.stubEnv('NUM', 'not-a-number');

    expect(() => env.load({ foo: env.string('FOO'), num: env.number('NUM') })).toThrow(
      'Failed to load config: FOO ($.foo): required, NUM ($.num): invalid number',
    );
  });

  it('reads real values from process.env for a full spec', () => {
    vitest.stubEnv('FOO', 'hello');
    vitest.stubEnv('BAR', 'true');
    vitest.stubEnv('BAZ', 'b');
    vitest.stubEnv('NUM', '3.5');

    const result = env.load({
      foo: env.string('FOO'),
      bar: env.boolean('BAR'),
      baz: env.enum('BAZ', ['a', 'b', 'c']),
      num: env.number('NUM'),
    });

    expect(result).toEqual({ foo: 'hello', bar: true, baz: 'b', num: 3.5 });
  });

  it('applies default values for keys missing from process.env', () => {
    vitest.stubEnv('FOO', undefined);
    vitest.stubEnv('FLAG', undefined);

    const result = env.load({
      foo: env.string('FOO', 'default-foo'),
      flag: env.boolean('FLAG', false),
    });

    expect(result).toEqual({ foo: 'default-foo', flag: false });
  });
});
