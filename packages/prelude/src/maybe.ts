export type Maybe<T> = T | undefined;

export function mapMaybe<T, U>(value: Maybe<T>, fn: (value: T) => U): Maybe<U> {
  return value === undefined ? undefined : fn(value);
}

export function isDefined<T>(value: Maybe<T>): value is T {
  return value !== undefined;
}

export function flattenMaybe<T>(value: Maybe<Maybe<T>>): Maybe<T> {
  return mapMaybe(value, (v) => v);
}

export function ifTrue<T>(value: boolean, fn: () => T): Maybe<T> {
  return value ? fn() : undefined;
}

export function ifFalse<T>(value: boolean, fn: () => T): Maybe<T> {
  return !value ? fn() : undefined;
}

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
