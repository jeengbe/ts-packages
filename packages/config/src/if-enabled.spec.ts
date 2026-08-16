import { env } from './env.js';
import { ifEnabled } from './if-enabled.js';
import { describe, expect, it } from 'vitest';

describe('ifEnabled', () => {
  const spec = ifEnabled('FEATURE_ENABLED', {
    foo: env.string('FOO', 'default'),
  });

  it('returns the enabled branch when the env var is "true"', () => {
    const result = env.load(spec, {
      FEATURE_ENABLED: 'true',
    });

    expect(result).toEqual({ enabled: true, foo: 'default' });
  });

  it('returns the disabled branch when the env var is "false"', () => {
    const result = env.load(spec, {
      FEATURE_ENABLED: 'false',
    });

    expect(result).toEqual({ enabled: false });
  });

  it('throws when the env var is neither "true" nor "false"', () => {
    expect(() =>
      env.load(spec, {
        FEATURE_ENABLED: 'maybe',
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Error: Environment validation failed:
        $.enabled (FEATURE_ENABLED): invalid boolean (must be 'true' or 'false'; got: 'maybe')]
    `);
  });

  it('defaults to disabled when the env var is missing', () => {
    const result = env.load(spec, {
      FEATURE_ENABLED: undefined,
    });

    expect(result).toEqual({ enabled: false });
  });
});
