/**
 * Represents a value that may be absent.
 */
export type Maybe<T> = T | undefined;

/**
 * Maps the value if it is defined, performs no operation if it is undefined.
 *
 * @example
 *
 * ```ts
 * const value: Maybe<number> = 5;
 * const result: Maybe<string> = mapMaybe(value, (v) => `Value is ${v}`); // "Value is 5"
 *
 * const undefinedValue: Maybe<number> = undefined;
 * const undefinedResult: Maybe<string> = mapMaybe(undefinedValue, (v) => `Value is ${v}`); // undefined
 * ```
 */
export function mapMaybe<T, U>(value: Maybe<T>, fn: (value: T) => U): Maybe<U> {
  return value === undefined ? undefined : fn(value);
}

/**
 * Returns true if the value is defined, false if it is undefined.
 *
 * @example
 *
 * ```ts
 * const definedValue: Maybe<number> = 5;
 *
 * if (isDefined(definedValue)) {
 *   console.log(definedValue + 1); // Output: 6
 * }
 * ```
 */
export function isDefined<T>(value: Maybe<T>): value is T {
  return value !== undefined;
}

/**
 * Flattens a nested Maybe into a single Maybe.
 *
 * @example
 *
 * ```ts
 * const nested: Maybe<Maybe<number>> = 5;
 * const flattened: Maybe<number> = flattenMaybe(nested); // 5
 * ```
 */
export function flattenMaybe<T>(value: Maybe<Maybe<T>>): Maybe<T> {
  return mapMaybe(value, (v) => v);
}

/**
 * Returns the result of the provided function if the value is true, undefined otherwise.
 */
export function ifTrue<T>(value: boolean, fn: () => T): Maybe<T> {
  return value ? fn() : undefined;
}

/**
 * Returns the result of the provided function if the value is false, undefined otherwise.
 */
export function ifFalse<T>(value: boolean, fn: () => T): Maybe<T> {
  return !value ? fn() : undefined;
}

/**
 * Matches a pair of Maybe values against the provided cases, depending on which of them are defined.
 *
 * @example
 *
 * ```ts
 * const a: Maybe<number> = 5;
 * const b: Maybe<string> = undefined;
 *
 * const result = matchPair([a, b], {
 *   neither: () => 'neither',
 *   a: (a) => `a is ${a}`,
 *   b: (b) => `b is ${b}`,
 *   both: (a, b) => `both are ${a} and ${b}`,
 * });
 *
 * console.log(result); // Output: "a is 5"
 * ```
 */
export function matchPair<A, B, R>(
  [a, b]: [Maybe<A>, Maybe<B>],
  cases: {
    neither: () => R;
    a: (a: A) => R;
    b: (b: B) => R;
    both: (a: A, b: B) => R;
  },
): R {
  if (!isDefined(a)) {
    if (!isDefined(b)) {
      return cases.neither();
    }

    return cases.b(b);
  }

  if (!isDefined(b)) {
    return cases.a(a);
  }

  return cases.both(a, b);
}
