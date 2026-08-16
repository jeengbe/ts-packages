import { Either } from '@jeengbe/prelude';

export type LoadConfigResult<T> = LoadConfigSuccess<T> | LoadConfigFailure;

export interface LoadConfigFailure {
  errors: readonly string[];
}

export interface LoadConfigSuccess<T> {
  value: T;
}

/**
 * The result of validating a config value: a Left of accumulated error messages, or a Right of the validated value.
 */
export type ValidationResult<T> = Either<readonly string[], T>;

/**
 * Combines multiple ValidationResults into one, preserving the tuple's value types. Succeeds with
 * all values if every result is a Right, or fails with all accumulated error messages otherwise.
 *
 * @example
 *
 * ```ts
 * const result1: ValidationResult<number> = Either.left(['error1']);
 * const result2: ValidationResult<string> = Either.right('value2');
 * const result3: ValidationResult<boolean> = Either.left(['error3']);
 *
 * const combinedResult = combineValidationResults(result1, result2, result3);
 *
 * console.log(combinedResult); // Output: Left(['error1', 'error3'])
 * ```
 *
 * @example
 *
 * ```ts
 * const result1: ValidationResult<number> = Either.right(42);
 * const result2: ValidationResult<string> = Either.right('value2');
 * const result3: ValidationResult<boolean> = Either.right(true);
 *
 * const combinedResult = combineValidationResults(result1, result2, result3);
 *
 * console.log(combinedResult); // Output: Right([42, 'value2', true])
 * ```
 */
export function combineValidationResults<const U extends readonly ValidationResult<unknown>[]>(
  ...results: U
): CombineValidationResult<U> {
  const errors = results.filter((r) => r.isLeft()).flatMap((r) => r.getLeft());

  return errors.length
    ? Either.left(errors)
    : (Either.right(results.map((r) => r.get())) as CombineValidationResult<U>);
}

type CombineValidationResult<T extends readonly ValidationResult<unknown>[]> = ValidationResult<{
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
