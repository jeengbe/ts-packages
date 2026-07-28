import { Either } from '@jeengbe/prelude';

export type ValidationResult<T> = Either<readonly string[], T>;

type CombineValidationResult<T extends readonly ValidationResult<unknown>[]> = ValidationResult<{
  [K in keyof T]: T[K] extends ValidationResult<infer U> ? U : never;
}>;

export function combineValidationResults<const U extends readonly ValidationResult<unknown>[]>(
  ...results: U
): CombineValidationResult<U> {
  const errors = results.filter((r) => r.isLeft()).flatMap((r) => r.getLeft());

  return errors.length
    ? Either.left(errors)
    : (Either.right(results.map((r) => r.get())) as CombineValidationResult<U>);
}

export function arrayIncludes<const T extends string>(arr: readonly T[], val: unknown): val is T {
  return arr.includes(val as T);
}
