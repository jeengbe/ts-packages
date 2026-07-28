import { env } from './env.js';
import type { ValidationResult } from './validation.js';
import { Either } from '@jeengbe/prelude';
import { afterEach, describe, expect, it, vitest } from 'vitest';

describe('env.string', () => {
  it('returns the value when present', () => {
    const node = env.string('FOO');

    expect(node.validate('$', () => 'bar').get()).toBe('bar');
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.string('FOO');

    expect(node.validate('$', () => undefined).getLeft()).toEqual(['FOO ($): required']);
  });

  it('falls back to the default value when missing', () => {
    const node = env.string('FOO', 'default');

    expect(node.validate('$', () => undefined).get()).toBe('default');
  });
});

describe('env.number', () => {
  it('parses integers', () => {
    const node = env.number('FOO');

    expect(node.validate('$', () => '42').get()).toBe(42);
  });

  it('parses negative integers', () => {
    const node = env.number('FOO');

    expect(node.validate('$', () => '-42').get()).toBe(-42);
  });

  it('parses decimals', () => {
    const node = env.number('FOO');

    expect(node.validate('$', () => '4.2').get()).toBe(4.2);
  });

  it('parses negative decimals', () => {
    const node = env.number('FOO');

    expect(node.validate('$', () => '-4.2').get()).toBe(-4.2);
  });

  it('rejects a trailing dot with no fractional digits', () => {
    const node = env.number('FOO');

    expect(node.validate('$', () => '4.').getLeft()).toEqual(['FOO ($): invalid number']);
  });

  it('rejects non-numeric strings', () => {
    const node = env.number('FOO');

    expect(node.validate('$', () => 'not-a-number').getLeft()).toEqual(['FOO ($): invalid number']);
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.number('FOO');

    expect(node.validate('$', () => undefined).getLeft()).toEqual(['FOO ($): required']);
  });

  it('falls back to the default value when missing', () => {
    const node = env.number('FOO', 7);

    expect(node.validate('$', () => undefined).get()).toBe(7);
  });
});

describe('env.boolean', () => {
  it('parses "true"', () => {
    const node = env.boolean('FOO');

    expect(node.validate('$', () => 'true').get()).toBe(true);
  });

  it('parses "false"', () => {
    const node = env.boolean('FOO');

    expect(node.validate('$', () => 'false').get()).toBe(false);
  });

  it('is case-insensitive', () => {
    const node = env.boolean('FOO');

    expect(node.validate('$', () => 'True').get()).toBe(true);
  });

  it('rejects arbitrary strings', () => {
    const node = env.boolean('FOO');

    expect(node.validate('$', () => 'yes').getLeft()).toEqual([
      "FOO ($): invalid boolean (must be 'true' or 'false')",
    ]);
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.boolean('FOO');

    expect(node.validate('$', () => undefined).getLeft()).toEqual(['FOO ($): required']);
  });

  it('falls back to the default value when missing', () => {
    const node = env.boolean('FOO', true);

    expect(node.validate('$', () => undefined).get()).toBe(true);
  });

  it('respects a default value of false', () => {
    const node = env.boolean('FOO', false);

    expect(node.validate('$', () => undefined).get()).toBe(false);
  });
});

describe('env.enum', () => {
  it('accepts a listed value', () => {
    const node = env.enum('FOO', ['a', 'b', 'c']);

    expect(node.validate('$', () => 'b').get()).toBe('b');
  });

  it('rejects an unlisted value', () => {
    const node = env.enum('FOO', ['a', 'b', 'c']);

    expect(node.validate('$', () => 'z').getLeft()).toEqual([
      "FOO ($): invalid enum value (must be one of: 'a', 'b', 'c')",
    ]);
  });

  it('is case-sensitive', () => {
    const node = env.enum('FOO', ['a', 'b', 'c']);

    expect(node.validate('$', () => 'A').getLeft()).toEqual([
      "FOO ($): invalid enum value (must be one of: 'a', 'b', 'c')",
    ]);
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.enum('FOO', ['a', 'b', 'c']);

    expect(node.validate('$', () => undefined).getLeft()).toEqual(['FOO ($): required']);
  });

  it('falls back to the default value when missing', () => {
    const node = env.enum('FOO', ['a', 'b', 'c'], 'b');

    expect(node.validate('$', () => undefined).get()).toBe('b');
  });
});

describe('env.custom', () => {
  it('uses the transformed value when defined', () => {
    const node = env.custom('FOO', (value) => Either.right(value.toUpperCase()));

    expect(node.validate('$', () => 'bar').get()).toBe('BAR');
  });

  it('wraps an invalid transform result with the key and path', () => {
    const node = env.custom('FOO', (value) =>
      value === 'valid' ? Either.right(value) : Either.left(['invalid value']),
    );

    expect(node.validate('$.foo', () => 'invalid').getLeft()).toEqual([
      'FOO ($.foo): invalid value',
    ]);
  });

  it('can transform into a non-string type', () => {
    const node = env.custom('FOO', (value) => Either.right(value.split(';')));

    expect(node.validate('$.foo', () => 'a;b;c').get()).toEqual(['a', 'b', 'c']);
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.custom('FOO', Either.right);

    expect(node.validate('$.foo', () => undefined).getLeft()).toEqual(['FOO ($.foo): required']);
  });

  it('falls back to the default value when missing', () => {
    const node = env.custom('FOO', Either.right, 'default');

    expect(node.validate('$.foo', () => undefined).get()).toBe('default');
  });

  it('does not invoke the transform when missing and a default is used', () => {
    const transform = vitest.fn<(value: string) => ValidationResult<string>>(Either.right);
    const node = env.custom('FOO', transform, 'default');

    node.validate('$', () => undefined);

    expect(transform).not.toHaveBeenCalled();
  });
});

describe('ScalarEnvNode#validate', () => {
  it('reads the raw value from the environment via the node key', () => {
    const node = env.string('FOO');

    expect(node.validate('$', (key) => (key === 'FOO' ? 'bar' : undefined)).get()).toBe('bar');
  });

  it('prefixes a validation error with the key and the given path', () => {
    const node = env.number('FOO');

    expect(node.validate('$.foo', () => 'nope').getLeft()).toEqual(['FOO ($.foo): invalid number']);
  });
});

describe('env.array', () => {
  it('splits and parses each comma-separated item', () => {
    const node = env.array(env.number('FOO'));

    expect(node.validate('$', () => '1,2,3').get()).toEqual([1, 2, 3]);
  });

  it('trims whitespace around items', () => {
    const node = env.array(env.string('FOO'));

    expect(node.validate('$', () => ' a , b ,c ').get()).toEqual(['a', 'b', 'c']);
  });

  it('treats a single item without commas as a one-element array', () => {
    const node = env.array(env.number('FOO'));

    expect(node.validate('$', () => '1').get()).toEqual([1]);
  });

  it('collects an error for every invalid item', () => {
    const node = env.array(env.number('FOO'));

    expect(node.validate('$', () => '1,x,3,y').getLeft()).toEqual([
      'FOO ($.1): invalid number',
      'FOO ($.3): invalid number',
    ]);
  });

  it('treats an empty item between commas as undefined for the item schema', () => {
    const node = env.array(env.number('FOO').optional());

    expect(node.validate('$', () => '1,,3').get()).toEqual([1, undefined, 3]);
  });

  it('fails a required item schema on an empty item between commas', () => {
    const node = env.array(env.number('FOO'));

    expect(node.validate('$', () => '1,,3').getLeft()).toEqual(['FOO ($.1): required']);
  });

  it('fails as required when missing and no default is given', () => {
    const node = env.array(env.number('FOO'));

    expect(node.validate('$', () => undefined).getLeft()).toEqual(['FOO ($): required']);
  });

  it('falls back to the default value when missing', () => {
    const node = env.array(env.number('FOO'), [9, 9]);

    expect(node.validate('$', () => undefined).get()).toEqual([9, 9]);
  });

  it('does not apply the item schema default value to a fully-missing array', () => {
    const node = env.array(env.number('FOO', 5));

    expect(node.validate('$.foo', () => undefined).getLeft()).toEqual(['FOO ($.foo): required']);
  });
});

describe('ScalarEnvNode#optional', () => {
  it('returns undefined when the value is missing', () => {
    const node = env.string('FOO').optional();

    expect(node.validate('$', () => undefined).get()).toBeUndefined();
  });

  it('ignores the wrapped node default value when missing', () => {
    const node = env.string('FOO', 'default').optional();

    expect(node.validate('$', () => undefined).get()).toBeUndefined();
  });

  it('still validates a present value', () => {
    const node = env.number('FOO').optional();

    expect(node.validate('$', () => 'not-a-number').getLeft()).toEqual(['FOO ($): invalid number']);
  });

  it('returns the parsed value when present', () => {
    const node = env.number('FOO').optional();

    expect(node.validate('$', () => '42').get()).toBe(42);
  });

  it('preserves the original key', () => {
    expect(env.string('FOO').optional().key).toBe('FOO');
  });

  it('can be chained without changing behavior', () => {
    const node = env.string('FOO').optional().optional();

    expect(node.validate('$', () => undefined).get()).toBeUndefined();
    expect(node.validate('$', () => 'bar').get()).toBe('bar');
  });
});

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

  it('rejects a whitespace-only env value as empty string', () => {
    vitest.stubEnv('FOO', '   ');

    expect(() => env.load({ foo: env.string('FOO') })).toThrow(
      'Failed to load config: FOO ($.foo): required',
    );
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
