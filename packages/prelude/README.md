<h1 align="center">@jeengbe/prelude</h1>
<div align="center">

A small, dependency-free functional programming toolkit for TypeScript.

[![License](https://img.shields.io/npm/l/@jeengbe/prelude)](https://github.com/jeengbe/ts-packages/blob/master/packages/prelude/LICENSE)
[![Version](https://img.shields.io/npm/v/@jeengbe/prelude)](https://www.npmjs.com/package/@jeengbe/prelude)
[![JSR](https://jsr.io/badges/@jeengbe/prelude)](https://jsr.io/@jeengbe/prelude)
[![Coverage](https://codecov.io/gh/jeengbe/ts-packages/branch/master/graph/badge.svg?component=prelude)](https://app.codecov.io/gh/jeengbe/ts-packages/tree/master/packages/prelude)

</div>

It provides an `Either` type for representing a value that's either a success or a failure (with an async-aware `EitherP` counterpart for `Promise`-returning pipelines), and a handful of small `Maybe` helpers for working with values that may be `undefined`.

## Installation

The package is published to [npm](https://www.npmjs.com/package/@jeengbe/prelude) and [JSR](https://jsr.io/@jeengbe/prelude) as `@jeengbe/prelude`. Versions follow Semantic Versioning.

## Usage

### `Either`

`Either<L, R>` is a union of `Left<L>` and `Right<R>`, conventionally used to represent a failure (`Left`) or a success (`Right`).

```ts
import { Either } from '@jeengbe/prelude';

const ok: Either<string, number> = Either.right(42);
const err: Either<string, number> = Either.left('something went wrong');
```

Because `Either<L, R>` is a plain union type, `isLeft()`/`isRight()` narrow it in both directions:

```ts
declare const e: Either<string, number>;

if (e.isLeft()) {
  e; // Left<string>
} else {
  e; // Right<number>
}
```

Use `map`/`leftMap`/`bimap` to transform the contained value without unwrapping it:

```ts
Either.right(2).map((n) => n * 2); // Right(4)
Either.left('oops').leftMap((e) => e.toUpperCase()); // Left('OOPS')
```

Use `flatMap`/`leftFlatMap` to chain further `Either`-returning operations:

```ts
declare function parseAge(input: string): Either<string, number>;

Either.right('42').flatMap(parseAge);
```

Use `tap`/`flatTap` to run a side effect on the right value without altering the `Either`:

```ts
Either.right(user).tap((u) => console.log(`loaded user ${u.id}`));
```

To get the values back out, `get()`/`getLeft()` return a `Maybe<T>` (i.e. `undefined` if this is the other side), `getOrElse` takes a fallback function for the right value, and `pair()` deconstructs the `Either` into a `[Maybe<L>, Maybe<R>]` tuple:

```ts
const [error, value] = result.pair();
const value2 = result.getOrElse(() => defaultValue);
```

`Either.fromMaybe` and `Either.cond` build an `Either` out of a `Maybe` or a boolean condition, respectively:

```ts
Either.fromMaybe(maybeUser, () => 'user not found');
Either.cond(
  items.length > 0,
  () => 'no items',
  () => items[0],
);
```

### `EitherP`

`EitherP<L, R>` it wraps a `PromiseLike<Either<L, R>>`: It exposes the same API as `Either`, and is itself directly awaitable.

```ts
import { EitherP } from '@jeengbe/prelude';

declare function fetchUser(id: string): Promise<Either<string, User>>;

const name = await EitherP.fromPromise(fetchUser('1'))
  .map((u) => u.name)
  .getOrElse(() => 'anonymous');
```

Every `Either` method has an `Async` counterpart (`mapAsync`, `flatMapAsync`, `tapAsync`, etc.) that accepts a function returning a `Promise` and returns an `EitherP`, letting you chain asynchronous steps without leaving the `Either` world:

```ts
Either.right(orderId)
  .flatMapAsync(async (id) =>
    (await isValid(id)) ? Either.right(id) : Either.left('invalid order'),
  )
  .tapAsync(async (id) => audit.log(id))
  .then((result) => result.get());
```

### `Maybe`

`Maybe<T>` is a type alias for `T | undefined`, along with a few helpers for working with values that may be missing:

- `isDefined` narrows a `Maybe<T>` to `T`.
- `mapMaybe` transforms the value if present, and passes `undefined` through otherwise.
- `flattenMaybe` collapses a `Maybe<Maybe<T>>` into a single level.
- `ifTrue`/`ifFalse` run a function conditionally, returning its result or `undefined`.
- `matchPair` pattern-matches a `[Maybe<A>, Maybe<B>]` tuple against all four presence combinations.

```ts
import { ifTrue, isDefined, mapMaybe, matchPair } from '@jeengbe/prelude';

const upper = mapMaybe(name, (n) => n.toUpperCase());

if (isDefined(upper)) {
  // upper: string
}

const warning = ifTrue(retries > 3, () => 'too many retries');

matchPair([error, value], {
  neither: () => 'nothing to report',
  a: (e) => `error: ${e}`,
  b: (v) => `value: ${v}`,
  both: (e, v) => `error ${e}, but got a partial value: ${v}`,
});
```
