import type { EnvSpec, ParseEnv, Pretty, ScalarValidationResultOrEither } from './ast.js';
import { EnvNode, ScalarEnvNode } from './ast.js';
import { ValidationResult } from './validation.js';
import { arrayIncludes, collectValidationResults } from './validation.js';
import { Either } from '@jeengbe/prelude';

/**
 * Type-safe configuration loader.
 *
 * @example
 *
 * ```ts
 * import { env } from '@jeengbe/config';
 *
 * const config = env.load({
 *   port: env.number('PORT', 3000),
 *   debug: env.boolean('DEBUG', false),
 *   driver: env.discriminate('driver', env.enum('DRIVER', ['memory', 'redis']), {
 *     memory: {},
 *     redis: { url: env.string('REDIS_URL') },
 *   }),
 * });
 *
 * // -> {
 * //   port: number;
 * //   debug: boolean;
 * //   driver: { driver: 'memory' } | { driver: 'redis'; url: string };
 * // }
 * ```
 *
 * Variables are read from `process.env` and trimmed before validation. Only a fully unset variable
 * falls back to a default value or fails as required - an explicitly empty value is passed through to
 * validation like any other input.
 */
export interface Env {
  /**
   * Reads a string environment variable.
   *
   * @example
   *
   * ```ts
   * const res = env.load(env.string('API_KEY'));
   * //    ^? string
   *
   * // API_KEY=abc-test -> 'abc-test'
   * // API_KEY=123 -> '123'
   * // API_KEY= -> ''
   * ```
   */
  string(key: string, defaultValue?: string): ScalarEnvNode<string>;

  /**
   * Reads a numeric environment variable. Must match `/^-?\d+(?:\.\d+)?$/`, i.e. `[-]digits[.digits]`.
   *
   * @example
   *
   * ```ts
   * const res = env.load(env.number('PORT'));
   * //    ^? number
   *
   * // PORT=3000 -> 3000
   * // PORT=-1 -> -1
   * // PORT=abc -> error
   * ```
   */
  number(key: string, defaultValue?: number): ScalarEnvNode<number>;

  /**
   * Reads a boolean environment variable (must be 'true' or 'false').
   *
   * @example
   *
   * ```ts
   * const res = env.load(env.boolean('DEBUG'));
   * //    ^? boolean
   *
   * // DEBUG=true -> true
   * // DEBUG=false -> false
   * // DEBUG=abc -> error
   * ```
   */
  boolean(key: string, defaultValue?: boolean): ScalarEnvNode<boolean>;

  /**
   * Reads an environment variable constrained to one of the provided values.
   *
   * @example
   *
   * ```ts
   * const res = env.load(env.enum('DRIVER', ['memory', 'redis']));
   * //    ^? 'memory' | 'redis'
   *
   * // DRIVER=memory -> 'memory'
   * // DRIVER=abc -> error
   * ```
   */
  enum<const T extends string>(
    key: string,
    values: readonly T[],
    defaultValue?: T,
  ): ScalarEnvNode<T>;

  /**
   * Reads a comma-separated list environment variable, validating each item against the provided item type.
   *
   * @example
   *
   * ```ts
   * const res = env.load(env.array(env.string('API_KEYS')));
   * //    ^? readonly string[]
   *
   * // API_KEYS=abc,def,ghi -> ['abc', 'def', 'ghi']
   * // API_KEYS= -> []
   * // API_KEYS=abc,,ghi -> error
   * ```
   *
   * @example
   *
   * ```ts
   * const res = env.load(env.array(env.string('API_KEYS'), ['default1', 'default2']));
   * //    ^? readonly string[]
   *
   * // API_KEYS=abc,def,ghi -> ['abc', 'def', 'ghi']
   * // API_KEYS= -> []
   * // (not set) -> ['default1', 'default2']
   * // API_KEYS=abc,,ghi -> error
   * ```
   *
   * @example
   *
   * ```ts
   * const res = env.load(env.array(env.string('API_KEYS').optional()));
   * //    ^? readonly (string | undefined)[]
   *
   * // API_KEYS=abc,def,ghi -> ['abc', 'def', 'ghi']
   * // API_KEYS= -> []
   * // API_KEYS=abc,,ghi -> ['abc', undefined, 'ghi']
   * ```
   */
  array<const T>(
    itemType: ScalarEnvNode<T>,
    defaultValue?: readonly T[],
  ): ScalarEnvNode<readonly T[]>;

  /**
   * Reads an environment variable, validating and transforming it with the provided function.
   *
   * @example
   *
   * ```ts
   * const res = env.load(
   *   //  ^? string
   *   env.scalar('TAG', (value, path) =>
   *     value.length === 3
   *       ? ValidationResult.success({ value, defaulted: [] })
   *       : ValidationResult.fail({
   *           errors: [{ path, key: 'TAG', message: 'must be 3 characters long', value }],
   *         }),
   *   ),
   * );
   *
   * // TAG=abc -> 'abc'
   * // TAG=abcd -> error
   * ```
   */
  scalar<const T>(
    key: string,
    transform: (value: string, path: string) => ScalarValidationResultOrEither<T>,
    defaultValue?: T,
  ): ScalarEnvNode<T>;

  /**
   * Reads a discriminator environment variable and resolves the nested schema mapped to its value.
   *
   * @example
   *
   * ```ts
   * const res = env.load(
   *   //  ^? { driver: 'memory'; } | { driver: 'redis'; url: string; }
   *   env.discriminate('driver', env.enum('DRIVER', ['memory', 'redis']), {
   *     memory: {},
   *     redis: { url: env.string('REDIS_URL') },
   *   }),
   * );
   *
   * // DRIVER=memory -> { driver: 'memory' }
   * // DRIVER=redis, REDIS_URL=redis://localhost -> { driver: 'redis', url: 'redis://localhost' }
   * // DRIVER=redis, REDIS_URL= -> { driver: 'redis', url: '' }
   * // DRIVER=abc -> error
   * ```
   */
  discriminate<
    K extends string,
    V extends string,
    M extends Partial<Record<V, Record<string, EnvSpec>>>,
  >(
    discriminatorKey: K,
    discriminatorValueType: ScalarEnvNode<V>,
    mapping: M,
  ): EnvNode<DiscriminatorResult<K, V, M>>;

  /**
   * Validates and loads the provided schema from `process.env`. Returns a `ValidationResult` that contains either the parsed values or a list of validation errors.
   *
   * @example
   *
   * ```ts
   * const result = env.parse({
   *   port: env.number('PORT'),
   *   debug: env.boolean('DEBUG'),
   * });
   *
   * if (result.getLeft()) {
   *   console.error('Validation failed:', result.getLeft());
   * } else {
   *   const config = result.get()!;
   *   // -> { port: number; debug: boolean; }
   * }
   * ```
   */
  parse<S extends EnvSpec>(spec: S, env?: NodeJS.ProcessEnv): ValidationResult<Pretty<ParseEnv<S>>>;

  /**
   * Validates and loads the provided schema from `process.env`. Throws if any required variables are missing or invalid.
   *
   * @example
   *
   * ```ts
   * const config = env.load({
   *   port: env.number('PORT', 3000),
   *   debug: env.boolean('DEBUG', false),
   * }, console.log);
   *
   * // -> {
   * //   port: number;
   * //   debug: boolean;
   * // }
   * ```
   */
  load<S extends EnvSpec>(spec: S, env?: NodeJS.ProcessEnv): Pretty<ParseEnv<S>>;
}

export const env: Env = {
  string(key: string, defaultValue?: string): ScalarEnvNode<string> {
    return env.scalar(
      key,
      (value): ValidationResult<string> => ValidationResult.success({ value, defaulted: [] }),
      defaultValue,
    );
  },

  number(key: string, defaultValue?: number): ScalarEnvNode<number> {
    return env.scalar(
      key,
      (value, path): ValidationResult<number> => {
        if (/^-?\d+(?:\.\d+)?$/.test(value)) {
          return ValidationResult.success({ value: Number(value), defaulted: [] });
        }

        return ValidationResult.fail({
          errors: [
            {
              path,
              key,
              message: 'invalid number',
              value,
            },
          ],
        });
      },
      defaultValue,
    );
  },

  boolean(key: string, defaultValue?: boolean): ScalarEnvNode<boolean> {
    return env.scalar(
      key,
      (value, path): ValidationResult<boolean> => {
        if (value.toLowerCase() === 'true') {
          return ValidationResult.success({ value: true, defaulted: [] });
        }

        if (value.toLowerCase() === 'false') {
          return ValidationResult.success({ value: false, defaulted: [] });
        }

        return ValidationResult.fail({
          errors: [
            {
              path,
              key,
              message: 'invalid boolean',
              formatHint: "must be 'true' or 'false'",
              value,
            },
          ],
        });
      },
      defaultValue,
    );
  },

  enum<const T extends string>(
    key: string,
    values: readonly T[],
    defaultValue?: T,
  ): ScalarEnvNode<T> {
    return env.scalar(
      key,
      (value, path): ValidationResult<T> => {
        if (arrayIncludes(values, value)) return ValidationResult.success({ value, defaulted: [] });

        return ValidationResult.fail({
          errors: [
            {
              path,
              key,
              message: 'invalid enum value',
              formatHint: `must be one of: ${values.map((v) => `'${v}'`).join(', ')}`,
              value,
            },
          ],
        });
      },
      defaultValue,
    );
  },

  array<const T>(
    itemType: ScalarEnvNode<T>,
    defaultValue?: readonly T[],
  ): ScalarEnvNode<readonly T[]> {
    return env.scalar(
      itemType.key,
      (value, path): ValidationResult<readonly T[]> => {
        // Special case because ''.split(',') returns [''] instead of [].
        if (value === '') return ValidationResult.success({ value: [], defaulted: [] });

        return collectValidationResults(
          ...value
            .split(',')
            .map((v) => v.trim() || undefined)
            .map((v, i) =>
              itemType.validate(
                (k) =>
                  // itemType always reads its own key, so this is never false
                  k === itemType.key ? v : /* v8 ignore next */ undefined,
                `${path}.${i}`,
              ),
            ),
        );
      },
      defaultValue,
    );
  },

  scalar<T>(
    key: string,
    transform: (value: string, path: string) => ScalarValidationResultOrEither<T>,
    defaultValue?: T,
  ): ScalarEnvNode<T> {
    return new ScalarEnvNode(key, (value, path): ScalarValidationResultOrEither<T> => {
      if (value === undefined) {
        if (defaultValue !== undefined) {
          return ValidationResult.success({
            value: defaultValue,
            defaulted: [
              {
                path,
                key,
                defaultValue,
              },
            ],
          });
        }

        return Either.left('required');
      }

      return transform(value, path);
    });
  },

  discriminate<
    K extends string,
    V extends string,
    M extends Partial<Record<V, Record<string, EnvSpec>>>,
  >(
    discriminatorKey: K,
    discriminatorValueType: ScalarEnvNode<V>,
    mapping: M,
  ): EnvNode<DiscriminatorResult<K, V, M>> {
    return new EnvNode((loadValue, path): ValidationResult<DiscriminatorResult<K, V, M>> => {
      return discriminatorValueType
        .validate(loadValue, `${path}.${discriminatorKey}`)
        .flatMap((discriminatorValue) => {
          return resolveNode<NonNullable<M[keyof M]> | {}>(
            path,
            mapping[discriminatorValue] ?? {},
            loadValue,
          ).map(
            (mappingValues) =>
              ({
                [discriminatorKey]: discriminatorValue,
                ...mappingValues,
              }) as DiscriminatorResult<K, V, M>,
          );
        });
    });
  },

  parse<S extends EnvSpec>(spec: S, env = process.env): ValidationResult<Pretty<ParseEnv<S>>> {
    return resolveNode('$', spec, (key) => env[key]?.trim());
  },

  load<S extends EnvSpec>(spec: S, env = process.env): Pretty<ParseEnv<S>> {
    return this.parse(spec, env).fold(
      (failure) => {
        throw new Error(
          `Environment validation failed:\n${failure.errors
            .map(
              (e) =>
                // oxlint-disable-next-line typescript/no-base-to-string
                `  ${e.path} (${e.key}): ${e.message} (${[e.formatHint, `got: '${String(e.value ?? '<not provided>')}'`].filter((x) => x).join('; ')})`,
            )
            .join('\n')}`,
        );
      },
      ({ value }) => value,
    );
  },
};

type DiscriminatorResult<
  K extends string,
  V extends string,
  M extends Partial<Record<V, Record<string, EnvSpec>>>,
> = Pretty<
  // This "redundant" condition is necessary to make sure that 'DiscriminatorResult' distributes over
  // the union type V
  V extends unknown ? Record<K, V> & ParseEnv<M[V] extends EnvSpec ? M[V] : {}> : never
>;

function resolveNode<S extends EnvSpec>(
  path: string,
  spec: S,
  loadValue: (key: string) => string | undefined,
): ValidationResult<Pretty<ParseEnv<S>>> {
  if (spec instanceof EnvNode) {
    return (spec as EnvNode<Pretty<ParseEnv<S>>>).validate(loadValue, path);
  }

  return collectValidationResults(
    ...Object.entries(spec).map(([key, value]) =>
      resolveNode(`${path}.${key}`, value, loadValue).map((v) => [key, v] as const),
    ),
  ).map((entries) => Object.fromEntries(entries) as Pretty<ParseEnv<S>>);
}
