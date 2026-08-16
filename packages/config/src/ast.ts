import { ValidationResult } from './validation.js';
import { Either, EitherBase } from '@jeengbe/prelude';

// oxlint-disable-next-line no-unused-vars -- Imported for JSDoc
import type { Env } from './env.js';
// oxlint-disable-next-line no-unused-vars -- Imported for JSDoc
import type { ValidationError, ValidationFailure } from './validation.js';

const nodeType = Symbol('type');

/**
 * A node in a config schema that validates a value out of the loaded environment.
 *
 * Do not instantiate this class directly; use the {@link Env} interface instead.
 */
export class EnvNode<T> {
  declare private readonly [nodeType]: T;
  readonly validate: (
    loadValue: (key: string) => string | undefined,
    path: string,
  ) => ValidationResult<T>;

  constructor(
    validate: (
      loadValue: (key: string) => string | undefined,
      path: string,
    ) => ValidationResultOrEither<T>,
  ) {
    this.validate = (loadValue, path) => recoverValidationResultOrEither(validate(loadValue, path));
  }

  /**
   * Transforms the validated value of this node into a new value, or fails validation.
   *
   * @example
   *
   * ```ts
   * const res = env.load(
   *   //  ^? number
   *   env.number('PORT').transform((port, path) =>
   *     port > 0
   *       ? ValidationResult.success({ value: port, defaulted: [] })
   *       : ValidationResult.fail({
   *           errors: [{ path, key: 'PORT', message: 'must be positive', value: port }],
   *         }),
   *   ),
   * );
   * ```
   */
  transform<U>(transform: (value: T, path: string) => ValidationResultOrEither<U>): EnvNode<U> {
    return new EnvNode((loadValue, path) =>
      this.validate(loadValue, path).flatMap((value) =>
        recoverValidationResultOrEither(transform(value, path)),
      ),
    );
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
    ) => ScalarValidationResultOrEither<T>,
  ) {
    super((loadValue, path) => {
      const value = loadValue(key);

      return recoverScalarValidationResultOrEither(validateValue(value, path), path, key, value);
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
   * // PORT= -> error
   * // (not set) -> undefined
   * ```
   */
  optional(): ScalarEnvNode<T | undefined> {
    return new ScalarEnvNode<T | undefined>(this.key, (value, path) =>
      value === undefined
        ? ValidationResult.success({
            value: undefined,
            defaulted: [
              {
                path,
                key: this.key,
                defaultValue: undefined,
              },
            ],
          })
        : this.validateValue(value, path),
    );
  }

  /**
   * Transforms the validated value of this node into a new value, or fails validation.
   *
   * As a shorthand for the common case of a single error message, `transform` may return a plain
   * `Either<string, U>` instead of a full `ValidationResult<U>`. The error string is automatically
   * wrapped into a {@link ValidationError} using this node's key, its path, and the value that failed to
   * transform.
   *
   * @example
   *
   * ```ts
   * const res = env.load(
   *   //  ^? number
   *   env.number('PORT').transform((port) =>
   *     port > 0 ? Either.right(port) : Either.left('must be positive'),
   *   ),
   * );
   * ```
   *
   * @example
   *
   * ```ts
   * const res = env.load(
   *   //  ^? number
   *   env.number('PORT').transform((port, path) =>
   *     port > 0
   *       ? ValidationResult.success({ value: port, defaulted: [] })
   *       : ValidationResult.fail({
   *           errors: [{ path, key: 'PORT', message: 'must be positive', value: port }],
   *         }),
   *   ),
   * );
   * ```
   */
  override transform<U>(
    transform: (value: T, path: string) => ScalarValidationResultOrEither<U>,
  ): ScalarEnvNode<U> {
    return new ScalarEnvNode(this.key, (value, path) =>
      recoverScalarValidationResultOrEither(
        this.validateValue(value, path),
        path,
        this.key,
        value,
      ).flatMap((val) =>
        recoverScalarValidationResultOrEither(transform(val, path), path, this.key, value),
      ),
    );
  }
}

export type ValidationResultOrEither<T> = ValidationResult<T> | Either<ValidationFailure, T>;

function recoverValidationResultOrEither<T>(
  result: ValidationResultOrEither<T>,
): ValidationResult<T> {
  if (result instanceof EitherBase) {
    return result.fold(
      (error) => ValidationResult.fail(error),
      (success) =>
        ValidationResult.success({
          value: success,
          defaulted: [],
        }),
    );
  }

  return result;
}

export type ScalarValidationResultOrEither<T> = ValidationResultOrEither<T> | Either<string, T>;

function recoverScalarValidationResultOrEither<T>(
  result: ScalarValidationResultOrEither<T>,
  path: string,
  key: string,
  value: unknown,
): ValidationResult<T> {
  if (result instanceof EitherBase) {
    return result.fold(
      (error) =>
        ValidationResult.fail(
          typeof error === 'object'
            ? error
            : {
                errors: [
                  {
                    path,
                    key,
                    message: error,
                    value,
                  },
                ],
              },
        ),
      (success) =>
        ValidationResult.success({
          value: success,
          defaulted: [],
        }),
    );
  }

  return result;
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
