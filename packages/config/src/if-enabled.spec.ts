import { env } from './env.js';
import { ifEnabled } from './if-enabled.js';
import { describe, expect, it, vitest } from 'vitest';

describe('ifEnabled', () => {
  const spec = ifEnabled('FEATURE_ENABLED', {
    foo: env.string('FOO', 'default'),
  });

  it('returns the enabled branch when the env var is "true"', () => {
    vitest.stubEnv('FEATURE_ENABLED', 'true');

    const result = env.load(spec);

    expect(result).toEqual({ enabled: true, foo: 'default' });
  });

  it('returns the disabled branch when the env var is "false"', () => {
    vitest.stubEnv('FEATURE_ENABLED', 'false');

    const result = env.load(spec);

    expect(result).toEqual({ enabled: false });
  });

  it('throws when the env var is neither "enabled" nor "disabled"', () => {
    vitest.stubEnv('FEATURE_ENABLED', 'maybe');

    expect(() => env.load(spec)).toThrow(
      "Failed to load config: FEATURE_ENABLED ($): invalid boolean (must be 'true' or 'false')",
    );
  });

  it('defaults to disabled when the env var is missing', () => {
    vitest.stubEnv('FEATURE_ENABLED', undefined);

    const result = env.load(spec);

    expect(result).toEqual({ enabled: false });
  });
});
