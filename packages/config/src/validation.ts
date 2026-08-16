import { Either, mapMaybe, Maybe } from '@jeengbe/prelude';

/**
 * The result of validating a config value: a Left of accumulated structured errors, or a Right of the
 * validated value together with a log of every default value that was substituted along the way.
 *
 * `map` and `flatMap` behave like a regular value monad, except that `flatMap` also concatenates the
 * defaulted-key log of both sides instead of discarding either - so chaining validations never loses
 * track of which defaults were applied upstream.
 */
export class ValidationResult<T> {
  private constructor(private readonly result: Either<ValidationFailure, ValidationSuccess<T>>) {}

  /**
   * Creates a successful ValidationResult with the given value and log of defaulted keys.
   */
  static success<T>(success: ValidationSuccess<T>): ValidationResult<T> {
    return new ValidationResult(Either.right(success));
  }

  /**
   * Creates a failed ValidationResult with the given errors.
   */
  static fail(failure: ValidationFailure): ValidationResult<never> {
    return new ValidationResult(Either.left(failure));
  }

  /**
   * Maps the value of this ValidationResult if it succeeded, preserving its defaulted-key log. Performs
   * no operation if this is a failure.
   */
  map<U>(f: (value: T) => U): ValidationResult<U> {
    return new ValidationResult(
      this.result.map(({ defaulted, value }) => ({ defaulted, value: f(value) })),
    );
  }

  /**
   * Flat maps the value of this ValidationResult if it succeeded, concatenating the defaulted-key log of
   * this result with that of the one returned by `f`. Performs no operation if this is a failure.
   */
  flatMap<U>(f: (value: T) => ValidationResult<U>): ValidationResult<U> {
    return new ValidationResult(
      this.result.flatMap(({ defaulted, value }) =>
        f(value).result.map(({ defaulted: newDefaulted, value: newValue }) => ({
          defaulted: [...defaulted, ...newDefaulted],
          value: newValue,
        })),
      ),
    );
  }

  /**
   * Returns a new ValidationResult with the given defaulted key appended to the log. Performs no
   * operation if this is a failure.
   */
  tell(newDefaulted: ValidationDefaulted): ValidationResult<T> {
    return new ValidationResult(
      this.result.map(({ defaulted, value }) => ({
        defaulted: [...defaulted, newDefaulted],
        value,
      })),
    );
  }

  /**
   * Applies the provided functions to this ValidationResult, depending on whether it failed or succeeded,
   * and returns the result.
   */
  fold<R1, R2>(
    onFailure: (failure: ValidationFailure) => R1,
    onSuccess: (success: ValidationSuccess<T>) => R2,
  ): R1 | R2 {
    return this.result.fold(onFailure, onSuccess);
  }

  getLeft(): Maybe<ValidationFailure> {
    return this.result.getLeft();
  }

  get(): Maybe<T> {
    return mapMaybe(this.result.get(), ({ value }) => value);
  }
}

export interface ValidationFailure {
  errors: readonly ValidationError[];
}

/**
 * A single structured validation error, pinpointing the key and path it occurred at.
 */
export interface ValidationError {
  path: string;
  key: string;
  message: string;
  formatHint?: string;
  value: unknown;
}

export interface ValidationSuccess<T> {
  defaulted: readonly ValidationDefaulted[];
  value: T;
}

/**
 * Records that a default value was substituted in place of a missing environment variable.
 */
export interface ValidationDefaulted {
  path: string;
  key: string;
  defaultValue: unknown;
}

/**
 * Combines multiple ValidationResults into one, preserving the tuple's value types. Succeeds with all
 * values and the concatenation of every branch's defaulted-key log if every result succeeded, or fails
 * with all accumulated errors otherwise.
 *
 * @example
 *
 * ```ts
 * const result1: ValidationResult<number> = ValidationResult.fail({
 *   errors: [{ path: '$.a', key: 'A', message: 'error1', value: undefined }],
 * });
 * const result2: ValidationResult<string> = ValidationResult.success({ value: 'value2', defaulted: [] });
 * const result3: ValidationResult<boolean> = ValidationResult.fail({
 *   errors: [{ path: '$.c', key: 'C', message: 'error3', value: undefined }],
 * });
 *
 * const combinedResult = collectValidationResults(result1, result2, result3);
 *
 * console.log(combinedResult); // Left with both `error1` and `error3`
 * ```
 *
 * @example
 *
 * ```ts
 * const result1: ValidationResult<number> = ValidationResult.success({ value: 42, defaulted: [] });
 * const result2: ValidationResult<string> = ValidationResult.success({ value: 'value2', defaulted: [] });
 * const result3: ValidationResult<boolean> = ValidationResult.success({ value: true, defaulted: [] });
 *
 * const combinedResult = collectValidationResults(result1, result2, result3);
 *
 * console.log(combinedResult); // Right([42, 'value2', true])
 * ```
 */
export function collectValidationResults<const U extends readonly ValidationResult<unknown>[]>(
  ...results: U
): CollectValidationResult<U> {
  const errors: ValidationError[] = [];
  const defaulted: ValidationDefaulted[] = [];
  const values: unknown[] = [];

  for (const result of results) {
    result.fold(
      (failure) => errors.push(...failure.errors),
      (success) => {
        defaulted.push(...success.defaulted);
        values.push(success.value);
      },
    );
  }

  return (
    errors.length
      ? ValidationResult.fail({ errors })
      : ValidationResult.success({ defaulted, value: values })
  ) as CollectValidationResult<U>;
}

type CollectValidationResult<T extends readonly ValidationResult<unknown>[]> = ValidationResult<{
  [K in keyof T]: T[K] extends ValidationResult<infer U> ? U : never;
}>;

/**
 * Type guard checking whether val is one of the values in arr.
 */
export function arrayIncludes<const T extends string | number | boolean | null | undefined>(
  arr: readonly T[],
  val: unknown,
): val is T {
  return arr.includes(val as T);
}
