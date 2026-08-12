import type { EnvNode, EnvSpec, InferEnvSpec } from './ast.js';
import { env } from './env.js';
import type { ValidationResult } from './validation.js';
import { Either } from '@jeengbe/prelude';

type IfEnabled<T> =
  | ({
      enabled: true;
    } & Omit<T, 'enabled'>)
  | { enabled: false };

export function ifEnabled<T extends Record<string, EnvSpec>>(
  envVar: string,
  config: T,
  defaultEnabled = false,
): EnvNode<IfEnabled<InferEnvSpec<T>>> {
  // Since discriminate only works with string values, we need to bridge 'true' -> 'enabled' -> true
  return env
    .discriminate(
      'enabled',
      env
        .boolean(envVar, defaultEnabled)
        .transform(
          (v): ValidationResult<'enabled' | 'disabled'> => Either.right(v ? 'enabled' : 'disabled'),
        ),
      {
        enabled: config,
      },
    )
    .transform((value): ValidationResult<IfEnabled<InferEnvSpec<T>>> => {
      if (value.enabled === 'enabled') {
        return Either.right({
          ...value,
          enabled: true,
        });
      }

      return Either.right({
        enabled: false,
      });
    });
}
