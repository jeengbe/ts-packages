// oxlint-disable-next-line no-unused-vars -- Used in JSDoc
import { Env } from './env.js';

import type { ValidationResult } from './validation.js';
import { Either } from '@jeengbe/prelude';

const nodeType = Symbol('type');

/**
 * A node in a config schema that validates a value out of the loaded environment.
 *
 * Do not instantiate this class directly; use the {@link Env} interface instead.
 */
export class EnvNode<T> {
  declare private readonly [nodeType]: T;

  constructor(
    readonly validate: (
      path: string,
      loadValue: (key: string) => string | undefined,
    ) => ValidationResult<T>,
  ) {}

  /**
   * Transforms the validated value of this node into a new value, or fails validation.
   *
   * @example
   *
   * ```ts
   * const res = env.load(
   *   //  ^? number
   *   env
   *     .number('PORT')
   *     .transform((port) => (port > 0 ? Either.right(port) : Either.left(['must be positive']))),
   * );
   * ```
   */
  transform<U>(transform: (value: T) => ValidationResult<U>): EnvNode<U> {
    return new EnvNode((path, loadValue) => this.validate(path, loadValue).flatMap(transform));
  }
}

/**
 * An {@link EnvNode} backed by a single environment variable.
 *
 * Do not instantiate this class directly; use the {@link Env} interface instead.
 */
export class ScalarEnvNode<T> extends EnvNode<T> {
  constructor(
    readonly key: string,
    private readonly validateValue: (
      value: string | undefined,
      path: string,
    ) => ValidationResult<T>,
  ) {
    super((path, loadValue) => {
      return validateValue(loadValue(key), path).leftMap((errors) =>
        errors.map((error) => `${key} (${path}): ${error}`),
      );
    });
  }

  /**
   * Returns a new ScalarEnvNode that resolves to undefined instead of failing validation when the environment variable is not set.
   *
   * @example
   *
   * ```ts
   * const res = env.load(
   *   //  ^? number | undefined
   *   env.number('PORT').optional(),
   * );
   *
   * // PORT=3000 -> 3000
   * // PORT= -> undefined
   * // (not set) -> undefined
   * ```
   */
  optional(): ScalarEnvNode<T | undefined> {
    return new ScalarEnvNode<T | undefined>(this.key, (value, path) =>
      value === undefined ? Either.right(undefined) : this.validateValue(value, path),
    );
  }

  override transform<U>(transform: (value: T) => ValidationResult<U>): ScalarEnvNode<U> {
    return new ScalarEnvNode(this.key, (value, path) =>
      this.validateValue(value, path).flatMap(transform),
    );
  }
}

/**
 * Describes the shape of a config schema: either a single EnvNode, or a nested object of them.
 */
export type EnvSpec = EnvNode<unknown> | { [key: string]: EnvSpec };

/**
 * Infers the resulting value type produced by loading an EnvSpec.
 *
 * @example
 * ```ts
 * export function createModuleConfig() {
 *  return {
 *    url: env.string('URL'),
 *    port: env.number('PORT').optional(),
 *  };
 * }
 *
 * export type ModuleConfig = ParseEnv<ReturnType<typeof createModuleConfig>>;
 * //    ^? { url: string; port?: number | undefined; }
 * ```
 */
export type ParseEnv<T extends EnvSpec> =
  T extends EnvNode<infer U>
    ? U
    : T extends Record<string, EnvSpec>
      ? { [K in keyof T]: ParseEnv<T[K]> }
      : never;

export type Pretty<T> = T extends infer U extends object ? { [K in keyof U]: Pretty<U[K]> } : T;
