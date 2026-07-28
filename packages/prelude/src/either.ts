import type { Maybe } from './maybe.js';
import { isDefined } from './maybe.js';

// Note that xxxAsync implementations in Either all look like:
// EitherP.fromPromise(toEitherPromise(this)).xxxAsync(...)
//
// And conversely, xxx implementations in EitherP all look like:
// new EitherP(this.value.then(e => e.xxx(...)))

abstract class EitherBase<L, R> {
  /**
   * Maps the value of this Either if it is a Right, performs no operation if this is a Left.
   */
  map<R2>(fn: (t: R) => R2): Either<L, R2> {
    return this.flatMap((value) => Either.right(fn(value)));
  }

  mapAsync<R2>(fn: (t: R) => Promise<R2>): EitherP<L, R2> {
    return EitherP.fromPromise(toEitherPromise(this)).mapAsync(fn);
  }

  /**
   * Flat maps the value of this Either if it is a Left, performs no operation if this is a Right.
   */
  leftFlatMap<L2, R2>(fn: (t: L) => Either<L2, R2>): Either<L2, R | R2> {
    return this.fold(
      (l) => fn(l),
      (r) => Either.right(r),
    );
  }

  leftFlatMapAsync<L2, R2>(fn: (t: L) => PromiseLike<Either<L2, R2>>): EitherP<L2, R | R2> {
    return EitherP.fromPromise(toEitherPromise(this)).leftFlatMapAsync(fn);
  }

  /**
   * Maps the value of this Either if it is a Left, performs no operation if this is a Right.
   */
  leftMap<L2>(fn: (t: L) => L2): Either<L2, R> {
    return this.fold(
      (l) => Either.left(fn(l)),
      (r) => Either.right(r),
    );
  }

  leftMapAsync<L2>(fn: (t: L) => Promise<L2>): EitherP<L2, R> {
    return EitherP.fromPromise(toEitherPromise(this)).leftMapAsync(fn);
  }

  /**
   * Applies the provided functions to the value of this Either, depending on whether it is a Right or a Left and returns a new Either.
   */
  bimap<L2, R2>(leftFn: (l: L) => L2, rightFn: (r: R) => R2): Either<L2, R2> {
    return this.fold(
      (l) => Either.left(leftFn(l)),
      (r) => Either.right(rightFn(r)),
    );
  }

  bimapAsync<L2, R2>(
    leftFn: (l: L) => Promise<L2>,
    rightFn: (r: R) => Promise<R2>,
  ): EitherP<L2, R2> {
    return EitherP.fromPromise(toEitherPromise(this)).bimapAsync(leftFn, rightFn);
  }

  /**
   * Runs the provided function with the value of this Either if it is a Right, performs no operation if this is a Left.
   */
  tap(fn: (t: R) => void): Either<L, R> {
    return this.flatMap((value) => {
      fn(value);
      return Either.right(value);
    });
  }

  tapAsync(fn: (t: R) => Promise<void>): EitherP<L, R> {
    return EitherP.fromPromise(toEitherPromise(this)).tapAsync(fn);
  }

  /**
   * Runs the provided function with the value of this Either if it is a Right, performs no operation if this is a Left.
   * If the result of the function is a Left, it will be returned, otherwise the original Right value will be returned.
   */
  flatTap<L2>(fn: (t: R) => Either<L2, void>): Either<L | L2, R> {
    return this.flatMap((value) => fn(value).map(() => value));
  }

  flatTapAsync<L2>(fn: (t: R) => PromiseLike<Either<L2, void>>): EitherP<L | L2, R> {
    return EitherP.fromPromise(toEitherPromise(this)).flatTapAsync(fn);
  }

  /**
   * Flat maps the value of this Either if it is a Right, performs no operation if this is a Left.
   */
  flatMap<L2, R2>(fn: (t: R) => Either<L2, R2>): Either<L | L2, R2> {
    return this.fold(
      (l) => Either.left(l),
      (r) => fn(r),
    );
  }

  flatMapAsync<L2, R2>(fn: (t: R) => PromiseLike<Either<L2, R2>>): EitherP<L | L2, R2> {
    return EitherP.fromPromise(toEitherPromise(this)).flatMapAsync(fn);
  }

  /**
   * Applies the provided functions to the value of this Either, depending on whether it is a Right or a Left and returns the result.
   */
  abstract fold<U1, U2>(leftFn: (l: L) => U1, rightFn: (r: R) => U2): U1 | U2;

  /**
   * Allows to deconstruct the Either using:
   *
   * @example
   *
   * ```ts
   * declare const e: Either<string, number>;
   *
   * const [left, right] = e.pair();
   * ```
   *
   */
  pair(): [Maybe<L>, Maybe<R>] {
    return [this.getLeft(), this.get()];
  }

  /**
   * Returns true if this Either is a Right, false otherwise.
   */
  isRight(): this is Right<R> {
    return this.fold(
      () => false,
      () => true,
    );
  }

  /**
   * Returns true if this Either is a Left, false otherwise.
   */
  isLeft(): this is Left<L> {
    return this.fold(
      () => true,
      () => false,
    );
  }

  /**
   * Gets the right value if this is a Right or undefined if it's a Left.
   */
  get(): Maybe<R> {
    return this.fold(
      () => undefined,
      (r) => r,
    );
  }

  /**
   * Returns the left value if this is a Left or undefined if it's a Right.
   */
  getLeft(): Maybe<L> {
    return this.fold(
      (l) => l,
      () => undefined,
    );
  }

  /**
   * Gets the right value if this is a Right or the result of the provided function if it's a Left.
   */
  getOrElse<T>(defaultValue: (l: L) => T): R | T {
    return this.fold(
      (l) => defaultValue(l),
      (r) => r,
    );
  }
}

// EitherBase is abstract with only Left/Right as concrete subclasses; the cast is always valid.
function toEitherPromise<L, R>(e: EitherBase<L, R>): Promise<Either<L, R>> {
  return Promise.resolve(e as unknown as Either<L, R>);
}

export class Left<L> extends EitherBase<L, never> {
  constructor(private readonly value: L) {
    super();
  }

  fold<U1, U2>(leftFn: (l: L) => U1, _rightFn: (r: never) => U2): U1 | U2 {
    return leftFn(this.value);
  }

  override getLeft(): L {
    return this.value;
  }
}

export class Right<R> extends EitherBase<never, R> {
  constructor(private readonly value: R) {
    super();
  }

  fold<U1, U2>(_leftFn: (l: never) => U1, rightFn: (r: R) => U2): U1 | U2 {
    return rightFn(this.value);
  }

  override get(): R {
    return this.value;
  }
}

/**
 * Mimics the [Cats Either[L, R]](https://typelevel.org/cats/datatypes/either.html) type.
 *
 * Either<L, R> is a union of Left<L> and Right<R>, so narrowing works in both directions:
 *
 * ```ts
 * declare const e: Either<string, number>;
 *
 * if (e.isLeft()) {
 *   e; // Left<string>
 * } else {
 *   e; // Right<number>
 * }
 * ```
 */
export type Either<L, R> = Left<L> | Right<R>;

export namespace Either {
  /**
   * Creates a new Left Either with the provided value.
   */
  export function left<L>(value: L): Either<L, never> {
    return new Left(value);
  }

  /**
   * Creates a new Right Either with the provided value.
   */
  export function right<R>(value: R): Either<never, R> {
    return new Right(value);
  }

  export function fromMaybe<L, R>(value: Maybe<R>, leftValue: () => L): Either<L, R> {
    return isDefined(value) ? Either.right(value) : Either.left(leftValue());
  }

  export function cond<L, R>(bool: boolean, rightFn: () => R, leftFn: () => L): Either<L, R> {
    return bool ? Either.right(rightFn()) : Either.left(leftFn());
  }
}

/**
 * Mimics the [Cats EitherT[Future, L, R]](https://typelevel.org/cats/datatypes/eithert.html) type.
 */
export class EitherP<L, R> implements PromiseLike<Either<L, R>> {
  private constructor(private readonly value: PromiseLike<Either<L, R>>) {}

  /**
   * Maps the value of this Either if it is a Right, performs no operation if this is a Left.
   */
  map<R2>(fn: (t: R) => R2): EitherP<L, R2> {
    return new EitherP(this.value.then((e) => e.map(fn)));
  }

  mapAsync<R2>(fn: (t: R) => Promise<R2>): EitherP<L, R2> {
    return this.flatMapAsync(async (value) => Either.right(await fn(value)));
  }

  /**
   * Maps the value of this Either if it is a Left, performs no operation if this is a Right.
   */
  leftMap<L2>(fn: (t: L) => L2): EitherP<L2, R> {
    return new EitherP(this.value.then((e) => e.leftMap(fn)));
  }

  leftMapAsync<L2>(fn: (t: L) => Promise<L2>): EitherP<L2, R> {
    return new EitherP(
      this.value.then(
        async (e) =>
          await e.fold(
            async (l) => Either.left(await fn(l)),
            async (r) => Either.right(r),
          ),
      ),
    );
  }

  /**
   * Flat maps the value of this Either if it is a Left, performs no operation if this is a Right.
   */
  leftFlatMap<L2, R2>(fn: (t: L) => Either<L2, R2>): EitherP<L2, R | R2> {
    return new EitherP(this.value.then((e) => e.leftFlatMap(fn)));
  }

  leftFlatMapAsync<L2, R2>(fn: (t: L) => PromiseLike<Either<L2, R2>>): EitherP<L2, R | R2> {
    return new EitherP(
      this.value.then<Either<L2, R | R2>>(
        async (e) =>
          await e.fold(
            async (left) => await fn(left),
            async (right) => Either.right(right),
          ),
      ),
    );
  }

  /**
   * Applies the provided functions to the value of this Either, depending on whether it is a Right or a Left and returns a new Either.
   */
  bimap<L2, R2>(leftFn: (l: L) => L2, rightFn: (r: R) => R2): EitherP<L2, R2> {
    return new EitherP(this.value.then((e) => e.bimap(leftFn, rightFn)));
  }

  bimapAsync<L2, R2>(
    leftFn: (l: L) => Promise<L2>,
    rightFn: (r: R) => Promise<R2>,
  ): EitherP<L2, R2> {
    return new EitherP(
      this.value.then(
        async (e) =>
          await e.fold(
            async (l) => Either.left(await leftFn(l)),
            async (r) => Either.right(await rightFn(r)),
          ),
      ),
    );
  }

  /**
   * Runs the provided function with the value of this Either if it is a Right, performs no operation if this is a Left.
   */
  tap(fn: (t: R) => void): EitherP<L, R> {
    return new EitherP(this.value.then((e) => e.tap(fn)));
  }

  tapAsync(fn: (t: R) => Promise<void>): EitherP<L, R> {
    return this.flatMapAsync(async (value) => {
      await fn(value);
      return Either.right(value);
    });
  }

  /**
   * Runs the provided function with the value of this Either if it is a Right, performs no operation if this is a Left.
   * If the result of the function is a Left, it will be returned, otherwise the original Right value will be returned.
   */
  flatTap<L2>(fn: (t: R) => Either<L2, void>): EitherP<L | L2, R> {
    return new EitherP(this.value.then((e) => e.flatTap(fn)));
  }

  flatTapAsync<L2>(fn: (t: R) => PromiseLike<Either<L2, void>>): EitherP<L | L2, R> {
    return this.flatMapAsync(async (value) => (await fn(value)).map(() => value));
  }

  /**
   * Flat maps the value of this Either if it is a Right, performs no operation if this is a Left.
   */
  flatMap<L2, R2>(fn: (t: R) => Either<L2, R2>): EitherP<L | L2, R2> {
    return new EitherP(this.value.then((e) => e.flatMap(fn)));
  }

  flatMapAsync<L2, R2>(fn: (t: R) => PromiseLike<Either<L2, R2>>): EitherP<L | L2, R2> {
    return new EitherP(
      this.value.then<Either<L | L2, R2>>((e) =>
        e.fold(
          async (left) => Either.left(left),
          (right) => fn(right),
        ),
      ),
    );
  }

  /**
   * Applies the provided functions to the value of this Either, depending on whether it is a Right or a Left and returns the result.
   */
  async fold<U1, U2>(leftFn: (l: L) => U1, rightFn: (r: R) => U2): Promise<U1 | U2> {
    return (await this.value).fold(leftFn, rightFn);
  }

  /**
   * Allows to deconstruct the Either using:
   *
   * @example
   *
   * ```ts
   * declare const e: EitherP<string, number>;
   *
   * const [left, right] = await e.pair();
   * ```
   *
   */
  async pair(): Promise<[Maybe<L>, Maybe<R>]> {
    return [await this.getLeft(), await this.get()];
  }

  /**
   * Returns true if this Either is a Right, false otherwise.
   */
  async isRight(): Promise<boolean> {
    return (await this.value).isRight();
  }

  /**
   * Returns true if this Either is a Left, false otherwise.
   */
  async isLeft(): Promise<boolean> {
    return !(await this.isRight());
  }

  /**
   * Gets the right value if this is a Right or undefined if it's a Left.
   */
  async get(): Promise<Maybe<R>> {
    return (await this.value).get();
  }

  /**
   * Returns the left value if this is a Left or undefined if it's a Right.
   */
  async getLeft(): Promise<Maybe<L>> {
    return (await this.value).getLeft();
  }

  /**
   * Gets the right value if this is a Right or the result of the provided function if it's a Left.
   */
  async getOrElse<T>(defaultValue: (l: L) => T): Promise<R | T> {
    return (await this.value).getOrElse(defaultValue);
  }

  /**
   * Creates a new Left EitherP with the provided value.
   */
  static left<L>(value: Promise<L>): EitherP<L, never> {
    return new EitherP(value.then((v) => Either.left(v)));
  }

  /**
   * Creates a new Right EitherP with the provided value.
   */
  static right<R>(value: Promise<R>): EitherP<never, R> {
    return new EitherP(value.then((v) => Either.right(v)));
  }

  static fromMaybe<L, R>(value: Promise<Maybe<R>>, leftValue: () => Promise<L>): EitherP<L, R> {
    return new EitherP(
      value.then(async (v) => (isDefined(v) ? Either.right(v) : Either.left(await leftValue()))),
    );
  }

  /**
   * @deprecated
   */
  static fromEither<L, R>(either: PromiseLike<Either<L, R>>): EitherP<L, R> {
    return new EitherP(either);
  }

  static fromPromise<L, R>(either: PromiseLike<Either<L, R>>): EitherP<L, R> {
    return new EitherP(either);
  }

  static cond<L, R>(
    bool: Promise<boolean>,
    rightFn: () => Promise<R>,
    leftFn: () => Promise<L>,
  ): EitherP<L, R> {
    return new EitherP(
      bool.then(async (b) => (b ? Either.right(await rightFn()) : Either.left(await leftFn()))),
    );
  }

  // oxlint-disable-next-line unicorn/no-thenable -- Deliberately implementing PromiseLike to allow for `await` usage on EitherP instances.
  then<U>(onfulfilled?: (value: Either<L, R>) => U | PromiseLike<U>): PromiseLike<U> {
    return this.value.then(onfulfilled);
  }
}
