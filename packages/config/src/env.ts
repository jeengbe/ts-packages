import type { EnvSpec, ParseEnv, Pretty } from './ast.js';
import { EnvNode, ScalarEnvNode } from './ast.js';
import type { ValidationResult } from './validation.js';
import { arrayIncludes, combineValidationResults } from './validation.js';
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
 * Variables are read from `process.env` and validated according to the provided schema.
 * Empty values are treated as undefined.
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
   * // API_KEY= -> undefined
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
   * // API_KEYS= -> error
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
   * // API_KEYS= -> ['default1', 'default2']
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
  array<T>(itemType: ScalarEnvNode<T>, defaultValue?: readonly T[]): ScalarEnvNode<readonly T[]>;

  /**
   * Reads an environment variable, validating and transforming it with the provided function.
   *
   * @example
   *
   * ```ts
   * const res = env.load(
   *   //  ^? string
   *   env.scalar('TAG', (value) =>
   *     Either.cond(value.length === 3, value, ['must be 3 characters long']),
   *   ),
   * );
   *
   * // TAG=abc -> 'abc'
   * // TAG=abcd -> error
   * ```
   */
  scalar<T>(
    key: string,
    transform: (value: string, path: string) => ValidationResult<T>,
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
   * // DRIVER=redis, REDIS_URL= -> error
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
   * Validates and loads the provided schema from `process.env`.
   */
  load<S extends EnvSpec>(spec: S): Either<LoadConfigFailure, Pretty<ParseEnv<S>>>;
}

export interface LoadConfigFailure {
  errors: readonly string[];
}

export const env: Env = {
  string(key, defaultValue) {
    return env.scalar(key, (value) => Either.right(value), defaultValue);
  },

  number(key, defaultValue) {
    return env.scalar(
      key,
      (value) => {
        if (/^-?\d+(?:\.\d+)?$/.test(value)) {
          return Either.right(Number(value));
        }

        return Either.left(['invalid number']);
      },
      defaultValue,
    );
  },

  boolean(key, defaultValue) {
    return env.scalar(
      key,
      (value) => {
        if (value.toLowerCase() === 'true') return Either.right(true);
        if (value.toLowerCase() === 'false') return Either.right(false);

        return Either.left(["invalid boolean (must be 'true' or 'false')"]);
      },
      defaultValue,
    );
  },

  enum(key, values, defaultValue) {
    return env.scalar(
      key,
      (value) => {
        if (arrayIncludes(values, value)) return Either.right(value);

        return Either.left([
          `invalid enum value (must be one of: ${values.map((v) => `'${v}'`).join(', ')})`,
        ]);
      },
      defaultValue,
    );
  },

  array<T>(itemType: ScalarEnvNode<T>, defaultValue?: readonly T[]): ScalarEnvNode<readonly T[]> {
    return env.scalar(
      itemType.key,
      (value, path) => {
        if (value === '') return Either.right([]);

        return combineValidationResults(
          ...value
            .split(',')
            .map((v) => v.trim() || undefined)
            .map((v, i) =>
              itemType.validate(`${path}.${i}`, (k) =>
                // itemType always reads its own key, so this is never false
                k === itemType.key ? v : /* v8 ignore next */ undefined,
              ),
            ),
        );
      },
      defaultValue,
    );
  },

  scalar(key, transform, defaultValue) {
    return new ScalarEnvNode(key, (value, path) => {
      if (value === undefined) {
        if (defaultValue !== undefined) return Either.right(defaultValue);
        return Either.left(['required']);
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
    return new EnvNode((path, loadValue) => {
      return discriminatorValueType.validate(path, loadValue).flatMap((discriminatorValue) => {
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

  load(spec) {
    return resolveNode('$', spec, (key) => process.env[key]?.trim()).leftMap((errors) => ({
      errors,
    }));
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
    return (spec as EnvNode<Pretty<ParseEnv<S>>>).validate(path, loadValue);
  }

  return combineValidationResults(
    ...Object.entries(spec).map(([key, value]) =>
      resolveNode(`${path}.${key}`, value, loadValue).map((v) => [key, v] as const),
    ),
  ).map((entries) => Object.fromEntries(entries) as Pretty<ParseEnv<S>>);
}
