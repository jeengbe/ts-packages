import { Either, EitherP } from './either.js';
import { assert, describe, expect, it, vitest } from 'vitest';

describe('Either', () => {
  describe('map', () => {
    it('should map the value if it is a Right', () => {
      const either = Either.right(5);

      const result = either.map((x) => x * 2);

      assert(result.isRight());
      expect(result.get()).toBe(10);
    });

    it('should not map the value if it is a Left', () => {
      const either = Either.left('error');

      const result = either.map((x) => x * 2);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('mapAsync', () => {
    it('should map the value asynchronously if it is a Right', async () => {
      const either = Either.right(5);

      const result = await either.mapAsync(async (x) => x * 2);

      assert(result.isRight());
      expect(result.get()).toBe(10);
    });

    it('should not map the value asynchronously if it is a Left', async () => {
      const either = Either.left('error');

      const result = await either.mapAsync(async (x) => x * 2);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('leftMap', () => {
    it('should leftMap the value if it is a Left', () => {
      const either = Either.left('error');

      const result = either.leftMap((x) => `Left: ${x}`);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });

    it('should not leftMap the value if it is a Right', () => {
      const either = Either.right(5);

      const result = either.leftMap(() => 'Left');

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });
  });

  describe('leftMapAsync', () => {
    it('should leftMap the value asynchronously if it is a Left', async () => {
      const either = Either.left('error');

      const result = await either.leftMapAsync(async (x) => `Left: ${x}`);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });

    it('should not leftMap the value asynchronously if it is a Right', async () => {
      const either = Either.right(5);

      const result = await either.leftMapAsync(async () => 'Left');

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });
  });

  describe('leftFlatMap', () => {
    it('should leftFlatMap the value if it is a Left', () => {
      const either = Either.left('error');

      const result = either.leftFlatMap((x) => Either.left(`Left: ${x}`));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });

    it('should not leftFlatMap the value if it is a Right', () => {
      const either = Either.right(5);

      const result = either.leftFlatMap(() => Either.left('Left'));

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });
  });

  describe('leftFlatMapAsync', () => {
    it('should leftFlatMap the value asynchronously if it is a Left', async () => {
      const either = Either.left('error');

      const result = await either.leftFlatMapAsync(async (x) => Either.left(`Left: ${x}`));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });

    it('should not leftFlatMap the value asynchronously if it is a Right', async () => {
      const either = Either.right(5);

      const result = await either.leftFlatMapAsync(async () => Either.left('Left'));

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });
  });

  describe('bimap', () => {
    it('should apply the right function if it is a Right', () => {
      const either = Either.right(5);

      const result = either.bimap(
        () => 'Left',
        (r) => `Right: ${r}`,
      );

      assert(result.isRight());
      expect(result.get()).toBe('Right: 5');
    });

    it('should apply the left function if it is a Left', () => {
      const either = Either.left('error');

      const result = either.bimap(
        (l) => `Left: ${l}`,
        () => 'Right',
      );

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });
  });

  describe('bimapAsync', () => {
    it('should apply the right function asynchronously if it is a Right', async () => {
      const either = Either.right(5);

      const result = await either.bimapAsync(
        async () => 'Left',
        async (r) => `Right: ${r}`,
      );

      assert(result.isRight());
      expect(result.get()).toBe('Right: 5');
    });

    it('should apply the left function asynchronously if it is a Left', async () => {
      const either = Either.left('error');

      const result = await either.bimapAsync(
        async (l) => `Left: ${l}`,
        async () => 'Right',
      );

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });
  });

  describe('tap', () => {
    it('should tap the value if it is a Right', () => {
      const fn = vitest.fn<() => void>();
      const either = Either.right(5);

      const result = either.tap(fn);

      assert(result.isRight());
      expect(result.get()).toBe(5);
      expect(fn).toHaveBeenCalledWith(5);
    });

    it('should not tap the value if it is a Left', () => {
      const fn = vitest.fn<() => void>();
      const either = Either.left('error');

      const result = either.tap(fn);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('tapAsync', () => {
    it('should tap the value if it is a Right', async () => {
      const fn = vitest.fn<() => Promise<void>>(async () => {});
      const either = Either.right(5);

      const result = await either.tapAsync(fn);

      assert(result.isRight());
      expect(result.get()).toBe(5);
      expect(fn).toHaveBeenCalledWith(5);
    });

    it('should not tap the value if it is a Left', async () => {
      const fn = vitest.fn<() => Promise<void>>(async () => {});
      const either = Either.left('error');

      const result = await either.tapAsync(fn);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('flatTap', () => {
    it('should flatTap the value if it is a Right', () => {
      const either = Either.right(5);

      const result = either.flatTap(() => Either.right(undefined));

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });

    it("should use the Left from the flatTap if it's a Left", () => {
      const either = Either.right(5);

      const result = either.flatTap(() => Either.left('error in tap'));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error in tap');
    });

    it('should not flatTap the value if it is a Left', () => {
      const either = Either.left('error');

      const result = either.flatTap(() => Either.right(undefined));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('flatTapAsync', () => {
    it('should flatTap the value if it is a Right', async () => {
      const either = Either.right(5);

      const result = await either.flatTapAsync(async () => Either.right(undefined));

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });

    it("should use the Left from the flatTapAsync if it's a Left", async () => {
      const either = Either.right(5);

      const result = await either.flatTapAsync(async () => Either.left('error in tap'));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error in tap');
    });

    it('should not flatTap the value if it is a Left', async () => {
      const either = Either.left('error');

      const result = await either.flatTapAsync(async () => Either.right(undefined));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('flatMap', () => {
    it('should flatMap the value if it is a Right', () => {
      const either = Either.right(5);

      const result = either.flatMap((x) => Either.right(x * 2));

      assert(result.isRight());
      expect(result.get()).toBe(10);
    });

    it('should not flatMap the value if it is a Left', () => {
      const either = Either.left('error');

      const result = either.flatMap((x) => Either.right(x * 2));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('flatMapAsync', () => {
    it('should flatMap the value asynchronously if it is a Right', async () => {
      const either = Either.right(5);

      const result = await either.flatMapAsync(async (x) => Either.right(x * 2));

      assert(result.isRight());
      expect(result.get()).toBe(10);
    });

    it('should not flatMap the value asynchronously if it is a Left', async () => {
      const either = Either.left('error');

      const result = await either.flatMapAsync(async (x) => Either.right(x * 2));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('fold', () => {
    it('should apply the right function if it is a Right', () => {
      const either = Either.right(5);

      const result = either.fold(
        () => 'Left',
        (r) => `Right: ${r}`,
      );

      expect(result).toBe('Right: 5');
    });

    it('should apply the left function if it is a Left', () => {
      const either = Either.left('error');

      const result = either.fold(
        (l) => `Left: ${l}`,
        () => 'Right',
      );

      expect(result).toBe('Left: error');
    });
  });

  describe('pair', () => {
    it('should return [undefined, R] for Right', () => {
      const either = Either.right(5);

      expect(either.pair()).toEqual([undefined, 5]);
    });

    it('should return [L, undefined] for Left', () => {
      const either = Either.left('error');

      expect(either.pair()).toEqual(['error', undefined]);
    });
  });

  describe('isRight', () => {
    it('should return true if it is a Right', () => {
      const either = Either.right(5);

      assert(either.isRight());
    });

    it('should return false if it is a Left', () => {
      const either = Either.left('error');

      assert(either.isLeft());
    });
  });

  describe('isLeft', () => {
    it('should return true if it is a Left', () => {
      const either = Either.left('error');

      expect(either.isLeft()).toBe(true);
    });

    it('should return false if it is a Right', () => {
      const either = Either.right(5);

      expect(either.isLeft()).toBe(false);
    });
  });

  describe('get', () => {
    it('should return the value if it is a Right', () => {
      const either = Either.right(5);

      expect(either.get()).toBe(5);
    });

    it('should return undefined if it is a Left', () => {
      const either = Either.left('error');

      expect(either.get()).toBeUndefined();
    });
  });

  describe('getLeft', () => {
    it('should return the value if it is a Left', () => {
      const either = Either.left('error');

      expect(either.getLeft()).toBe('error');
    });

    it('should return undefined if it is a Right', () => {
      const either = Either.right(5);

      expect(either.getLeft()).toBeUndefined();
    });
  });

  describe('getOrElse', () => {
    it('should return the value if it is a Right', () => {
      const either = Either.right(5);

      expect(either.getOrElse(() => 'default')).toBe(5);
    });

    it('should return the default value if it is a Left', () => {
      const either = Either.left('error');

      expect(either.getOrElse((l) => `Default: ${l}`)).toBe('Default: error');
    });
  });

  describe('left', () => {
    it('should create a Left Either', () => {
      const either = Either.left('error');

      expect(either.isLeft()).toBe(true);
      expect(either.getLeft()).toBe('error');
    });
  });

  describe('right', () => {
    it('should create a Right Either', () => {
      const either = Either.right(5);

      assert(either.isRight());
      expect(either.get()).toBe(5);
    });
  });

  describe('fromMaybe', () => {
    it('should create a Right Either from a defined Maybe', () => {
      const maybe = 5;
      const either = Either.fromMaybe(maybe, () => 'error');

      assert(either.isRight());
      expect(either.get()).toBe(5);
    });

    it('should create a Left Either from an undefined Maybe', () => {
      const maybe = undefined;
      const either = Either.fromMaybe(maybe, () => 'error');

      expect(either.isLeft()).toBe(true);
      expect(either.getLeft()).toBe('error');
    });
  });

  describe('cond', () => {
    it('should run the right function result if the value is true', () => {
      const either = Either.cond(
        true,
        () => `rightResult`,
        () => 'leftResult',
      );

      expect(either.isRight()).toBe(true);
      expect(either.get()).toBe('rightResult');
    });

    it('should return the left function result if the value is false', () => {
      const either = Either.cond(
        false,
        () => 'rightResult',
        () => 'leftResult',
      );

      expect(either.isLeft()).toBe(true);
      expect(either.getLeft()).toBe('leftResult');
    });
  });
});

describe('EitherP', () => {
  describe('map', () => {
    it('should map the value if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.map((x) => x * 2);

      assert(result.isRight());
      expect(result.get()).toBe(10);
    });

    it('should not map the value if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.map((x) => x * 2);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('mapAsync', () => {
    it('should map the value asynchronously if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.mapAsync(async (x) => x * 2);

      assert(result.isRight());
      expect(result.get()).toBe(10);
    });

    it('should not map the value asynchronously if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.mapAsync(async (x) => x * 2);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('leftMap', () => {
    it('should leftMap the value if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.leftMap((x) => `Left: ${x}`);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });

    it('should not leftMap the value if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.leftMap(() => 'Left');

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });
  });

  describe('leftMapAsync', () => {
    it('should leftMap the value asynchronously if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.leftMapAsync(async (x) => `Left: ${x}`);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });

    it('should not leftMap the value asynchronously if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.leftMapAsync(async () => 'Left');

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });
  });

  describe('leftFlatMap', () => {
    it('should leftFlatMap the value if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.leftFlatMap((x) => Either.left(`Left: ${x}`));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });

    it('should not leftFlatMap the value if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.leftFlatMap(() => Either.left('Left'));

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });
  });

  describe('leftFlatMapAsync', () => {
    it('should leftFlatMap the value asynchronously if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.leftFlatMapAsync(async (x) => Either.left(`Left: ${x}`));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });

    it('should not leftFlatMap the value asynchronously if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.leftFlatMapAsync(async () => Either.left('Left'));

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });
  });

  describe('bimap', () => {
    it('should apply the right function if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.bimap(
        () => 'Left',
        (r) => `Right: ${r}`,
      );

      assert(result.isRight());
      expect(result.get()).toBe('Right: 5');
    });

    it('should apply the left function if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.bimap(
        (l) => `Left: ${l}`,
        () => 'Right',
      );

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });
  });

  describe('bimapAsync', () => {
    it('should apply the right function asynchronously if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.bimapAsync(
        async () => 'Left',
        async (r) => `Right: ${r}`,
      );

      assert(result.isRight());
      expect(result.get()).toBe('Right: 5');
    });

    it('should apply the left function asynchronously if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.bimapAsync(
        async (l) => `Left: ${l}`,
        async () => 'Right',
      );

      assert(result.isLeft());
      expect(result.getLeft()).toBe('Left: error');
    });
  });

  describe('tap', () => {
    it('should tap the value if it is a Right', async () => {
      const fn = vitest.fn<() => void>();
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.tap(fn);

      assert(result.isRight());
      expect(result.get()).toBe(5);
      expect(fn).toHaveBeenCalledWith(5);
    });

    it('should not tap the value if it is a Left', async () => {
      const fn = vitest.fn<() => void>();
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.tap(fn);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('tapAsync', () => {
    it('should tap the value if it is a Right', async () => {
      const fn = vitest.fn<() => Promise<void>>(async () => {});
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.tapAsync(fn);

      assert(result.isRight());
      expect(result.get()).toBe(5);
      expect(fn).toHaveBeenCalledWith(5);
    });

    it('should not tap the value if it is a Left', async () => {
      const fn = vitest.fn<() => Promise<void>>(async () => {});
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.tapAsync(fn);

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('flatTap', () => {
    it('should flatTap the value if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.flatTap(() => Either.right(undefined));

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });

    it("should use the Left from the flatTap if it's a Left", async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.flatTap(() => Either.left('error in tap'));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error in tap');
    });

    it('should not flatTap the value if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.flatTap(() => Either.right(undefined));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('flatTapAsync', () => {
    it('should flatTap the value if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.flatTapAsync(async () => Either.right(undefined));

      assert(result.isRight());
      expect(result.get()).toBe(5);
    });

    it("should use the Left from the flatTapAsync if it's a Left", async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.flatTapAsync(async () => Either.left('error in tap'));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error in tap');
    });

    it('should not flatTap the value if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.flatTapAsync(async () => Either.right(undefined));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('flatMap', () => {
    it('should flatMap the value if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.flatMap((x) => Either.right(x * 2));

      assert(result.isRight());
      expect(result.get()).toBe(10);
    });

    it('should not flatMap the value if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.flatMap((x) => Either.right(x * 2));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('flatMapAsync', () => {
    it('should flatMap the value asynchronously if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.flatMapAsync(async (x) => Either.right(x * 2));

      assert(result.isRight());
      expect(result.get()).toBe(10);
    });

    it('should not flatMap the value asynchronously if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.flatMapAsync(async (x) => Either.right(x * 2));

      assert(result.isLeft());
      expect(result.getLeft()).toBe('error');
    });
  });

  describe('fold', () => {
    it('should apply the right function if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      const result = await either.fold(
        () => 'Left',
        (r) => `Right: ${r}`,
      );

      expect(result).toBe('Right: 5');
    });

    it('should apply the left function if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      const result = await either.fold(
        (l) => `Left: ${l}`,
        () => 'Right',
      );

      expect(result).toBe('Left: error');
    });
  });

  describe('pair', () => {
    it('should return [undefined, R] for Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      expect(await either.pair()).toEqual([undefined, 5]);
    });

    it('should return [L, undefined] for Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      expect(await either.pair()).toEqual(['error', undefined]);
    });
  });

  describe('isRight', () => {
    it('should return true if it is a Right', () => {
      const either = EitherP.right(Promise.resolve(5));

      assert(either.isRight());
    });

    it('should return false if it is a Left', () => {
      const either = EitherP.left(Promise.resolve('error'));

      assert(either.isLeft());
    });
  });

  describe('isLeft', () => {
    it('should return true if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      expect(await either.isLeft()).toBe(true);
    });

    it('should return false if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      expect(await either.isLeft()).toBe(false);
    });
  });

  describe('get', () => {
    it('should return the value if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      expect(await either.get()).toBe(5);
    });

    it('should return undefined if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      expect(await either.get()).toBeUndefined();
    });
  });

  describe('getLeft', () => {
    it('should return the value if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      expect(await either.getLeft()).toBe('error');
    });

    it('should return undefined if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      expect(await either.getLeft()).toBeUndefined();
    });
  });

  describe('getOrElse', () => {
    it('should return the value if it is a Right', async () => {
      const either = EitherP.right(Promise.resolve(5));

      expect(await either.getOrElse(() => 'default')).toBe(5);
    });

    it('should return the default value if it is a Left', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      expect(await either.getOrElse((l) => `Default: ${l}`)).toBe('Default: error');
    });
  });

  describe('left', () => {
    it('should create a Left Either', async () => {
      const either = EitherP.left(Promise.resolve('error'));

      expect(await either.isLeft()).toBe(true);
      expect(await either.getLeft()).toBe('error');
    });
  });

  describe('right', () => {
    it('should create a Right Either', async () => {
      const either = EitherP.right(Promise.resolve(5));

      assert(await either.isRight());
      expect(await either.get()).toBe(5);
    });
  });

  describe('fromMaybe', () => {
    it('should create a Right Either from a defined Maybe', async () => {
      const maybe = 5;
      const either = await EitherP.fromMaybe(Promise.resolve(maybe), () =>
        Promise.resolve('error'),
      );

      assert(either.isRight());
      expect(either.get()).toBe(5);
    });

    it('should create a Left Either from an undefined Maybe', async () => {
      const maybe = undefined;
      const either = await EitherP.fromMaybe(Promise.resolve(maybe), () =>
        Promise.resolve('error'),
      );

      expect(either.isLeft()).toBe(true);
      expect(either.getLeft()).toBe('error');
    });
  });

  describe('fromPromise', () => {
    it('should create an EitherP from a Promise of Either', async () => {
      const either = await EitherP.fromPromise(Promise.resolve(Either.right(5)));

      assert(either.isRight());
      expect(either.get()).toBe(5);
    });
  });

  describe('cond', () => {
    it('should run the right function result if the value is true', async () => {
      const either = await EitherP.cond(
        Promise.resolve(true),
        async () => 'rightResult',
        async () => 'leftResult',
      );

      expect(either.isRight()).toBe(true);
      expect(either.get()).toBe('rightResult');
    });

    it('should return the left function result if the value is false', async () => {
      const either = await EitherP.cond(
        Promise.resolve(false),
        async () => 'rightResult',
        async () => 'leftResult',
      );

      expect(either.isLeft()).toBe(true);
      expect(either.getLeft()).toBe('leftResult');
    });
  });
});
