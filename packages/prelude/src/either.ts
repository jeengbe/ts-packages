import type { Maybe } from './maybe.js';
import { isDefined } from './maybe.js';

// Note that xxxAsync implementations in Either all look like:
// EitherP.fromPromise(toEitherPromise(this)).xxxAsync(...)
//
// And conversely, xxx implementations in EitherP all look like:
// new EitherP(this.value.then(e => e.xxx(...)))

export abstract class EitherBase<L, R> {
  /**
   * Maps the value of this Either if it is a Right, performs no operation if this is a Left.
   */
  map<R2>(fn: (t: R) => R2): Either<L, R2> {
    return this.flatMap((value) => Either.right(fn(value)));
  }

  /**
   * Maps the value of this Either if it is a Right, performs no operation if this is a Left, asynchronously.
   */
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

  /**
   * Flat maps the value of this Either if it is a Left, performs no operation if this is a Right, asynchronously.
   */
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

  /**
   * Maps the value of this Either if it is a Left, performs no operation if this is a Right, asynchronously.
   */
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

  /**
   * Applies the provided functions to the value of this Either, depending on whether it is a Right or a Left and returns a new Either, asynchronously.
   */
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

  /**
   * Runs the provided function with the value of this Either if it is a Right, performs no operation if this is a Left, asynchronously.
   */
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

  /**
   * Runs the provided function with the value of this Either if it is a Right, performs no operation if this is a Left, asynchronously.
   * If the result of the function is a Left, it will be returned, otherwise the original Right value will be returned.
   */
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

  /**
   * Flat maps the value of this Either if it is a Right, performs no operation if this is a Left, asynchronously.
   */
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
    // Overridden in Right#get
    return undefined;
  }

  /**
   * Returns the left value if this is a Left or undefined if it's a Right.
   */
  getLeft(): Maybe<L> {
    // Overridden in Left#getLeft
    return undefined;
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

function toEitherPromise<L, R>(e: EitherBase<L, R>): Promise<Either<L, R>> {
  // EitherBase is abstract with only Left/Right as concrete subclasses; the cast is always valid.
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

  override toString(): string {
    return `Left(${String(this.value)})`;
  }

  get [Symbol.toStringTag](): string {
    return 'Left';
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

  override toString(): string {
    return `Right(${String(this.value)})`;
  }

  get [Symbol.toStringTag](): string {
    return 'Right';
  }
}

/**
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

  /**
   * Creates a Right Either from a Maybe if it is defined, or a Left Either from the result of the provided function otherwise.
   */
  export function fromMaybe<L, R>(value: Maybe<R>, leftValue: () => L): Either<L, R> {
    return isDefined(value) ? Either.right(value) : Either.left(leftValue());
  }

  /**
   * Creates a Right Either from the result of `rightFn` if `bool` is true, or a Left Either from the result of `leftFn` otherwise.
   */
  export function cond<L, R>(bool: boolean, leftFn: () => L, rightFn: () => R): Either<L, R> {
    return bool ? Either.right(rightFn()) : Either.left(leftFn());
  }
}

/**
 * Asynchronous version of @{link Either}, allowing for asynchronous operations on the values of the Either.
 *
 * ```ts
 * declare const e: EitherP<string, number>;
 *
 * const result = await e.get(); // result is of type Maybe<number>
 */
export class EitherP<L, R> implements PromiseLike<Either<L, R>> {
  private constructor(private readonly value: PromiseLike<Either<L, R>>) {}

  /**
   * Maps the value of this Either if it is a Right, performs no operation if this is a Left.
   */
  map<R2>(fn: (t: R) => R2): EitherP<L, R2> {
    return new EitherP(this.value.then((e) => e.map(fn)));
  }

  /**
   * Maps the value of this Either if it is a Right, performs no operation if this is a Left, asynchronously.
   */
  mapAsync<R2>(fn: (t: R) => Promise<R2>): EitherP<L, R2> {
    return this.flatMapAsync(async (value) => Either.right(await fn(value)));
  }

  /**
   * Maps the value of this Either if it is a Left, performs no operation if this is a Right.
   */
  leftMap<L2>(fn: (t: L) => L2): EitherP<L2, R> {
    return new EitherP(this.value.then((e) => e.leftMap(fn)));
  }

  /**
   * Maps the value of this Either if it is a Left, performs no operation if this is a Right, asynchronously.
   */
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

  /**
   * Flat maps the value of this Either if it is a Left, performs no operation if this is a Right, asynchronously.
   */
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

  /**
   * Applies the provided functions to the value of this Either, depending on whether it is a Right or a Left and returns a new Either, asynchronously.
   */
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

  /**
   * Runs the provided function with the value of this Either if it is a Right, performs no operation if this is a Left, asynchronously.
   */
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

  /**
   * Runs the provided function with the value of this Either if it is a Right, performs no operation if this is a Left, asynchronously.
   * If the result of the function is a Left, it will be returned, otherwise the original Right value will be returned.
   */
  flatTapAsync<L2>(fn: (t: R) => PromiseLike<Either<L2, void>>): EitherP<L | L2, R> {
    return this.flatMapAsync(async (value) => (await fn(value)).map(() => value));
  }

  /**
   * Flat maps the value of this Either if it is a Right, performs no operation if this is a Left.
   */
  flatMap<L2, R2>(fn: (t: R) => Either<L2, R2>): EitherP<L | L2, R2> {
    return new EitherP(this.value.then((e) => e.flatMap(fn)));
  }

  /**
   * Flat maps the value of this Either if it is a Right, performs no operation if this is a Left, asynchronously.
   */
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

  /**
   * Creates a Right EitherP from a Promise of a Maybe if it resolves to a defined value, or a Left EitherP from the result of the provided function otherwise.
   */
  static fromMaybe<L, R>(value: Promise<Maybe<R>>, leftValue: () => Promise<L>): EitherP<L, R> {
    return new EitherP(
      value.then(async (v) => (isDefined(v) ? Either.right(v) : Either.left(await leftValue()))),
    );
  }

  /**
   * Creates a new EitherP from a Promise of an Either.
   */
  static fromPromise<L, R>(either: PromiseLike<Either<L, R>>): EitherP<L, R> {
    return new EitherP(either);
  }

  /**
   * Creates a new Right EitherP if the provided Promise resolves to true, or a new Left EitherP otherwise.
   */
  static cond<L, R>(
    bool: Promise<boolean>,
    leftFn: () => Promise<L>,
    rightFn: () => Promise<R>,
  ): EitherP<L, R> {
    return new EitherP(
      bool.then(async (b) => (b ? Either.right(await rightFn()) : Either.left(await leftFn()))),
    );
  }

  /**
   * Resolves this EitherP to its underlying Either, allowing `await` usage on EitherP instances.
   */
  // oxlint-disable-next-line unicorn/no-thenable -- Deliberately implementing PromiseLike to allow for `await` usage on EitherP instances.
  then<U>(onfulfilled?: (value: Either<L, R>) => U | PromiseLike<U>): PromiseLike<U> {
    return this.value.then(onfulfilled);
  }
}
