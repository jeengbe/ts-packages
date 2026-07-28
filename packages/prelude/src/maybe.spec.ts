import type { Maybe } from './maybe.js';
import { flattenMaybe, ifFalse, ifTrue, isDefined, mapMaybe, matchPair } from './maybe.js';
import { describe, expect, it } from 'vitest';

describe('mapMaybe', () => {
  it('should map a value to another value if it is not undefined', () => {
    expect(mapMaybe(1, (value) => value + 1)).toBe(2);
  });

  it('should return undefined if the value is undefined', () => {
    expect(mapMaybe(undefined, (value: number) => value + 1)).toBeUndefined();
  });
});

describe('isDefined', () => {
  it('should return true for defined values', () => {
    expect(isDefined(1)).toBe(true);
    expect(isDefined('test')).toBe(true);
    expect(isDefined({})).toBe(true);
  });

  it('should return false for undefined values', () => {
    expect(isDefined(undefined)).toBe(false);
  });
});

describe('flattenMaybe', () => {
  it('should flatten a Maybe<Maybe<T>> to Maybe<T>', () => {
    expect(flattenMaybe(1)).toBe(1);
    expect(flattenMaybe(undefined as Maybe<number>)).toBeUndefined();
    expect(flattenMaybe(undefined as Maybe<Maybe<number>>)).toBeUndefined();
    expect(flattenMaybe(2 as Maybe<Maybe<number>>)).toBe(2);
  });
});

describe('ifTrue', () => {
  it('should return the result of the function if the value is true', () => {
    expect(ifTrue(true, () => 'result')).toBe('result');
  });

  it('should return undefined if the value is false', () => {
    expect(ifTrue(false, () => 'result')).toBeUndefined();
  });
});

describe('ifFalse', () => {
  it('should return the result of the function if the value is false', () => {
    expect(ifFalse(false, () => 'result')).toBe('result');
  });

  it('should return undefined if the value is true', () => {
    expect(ifFalse(true, () => 'result')).toBeUndefined();
  });
});

describe('matchPair', () => {
  it("should return 'neither' case when both values are undefined", () => {
    const result = matchPair([undefined, undefined], {
      neither: () => 'neither',
      a: (a) => `a: ${a}`,
      b: (b) => `b: ${b}`,
      both: (a, b) => `both: ${a}, ${b}`,
    });

    expect(result).toBe('neither');
  });

  it("should return 'a' case when first value is defined", () => {
    const result = matchPair([1, undefined], {
      neither: () => 'neither',
      a: (a) => `a: ${a}`,
      b: (b) => `b: ${b}`,
      both: (a, b) => `both: ${a}, ${b}`,
    });

    expect(result).toBe('a: 1');
  });

  it("should return 'b' case when second value is defined", () => {
    const result = matchPair([undefined, 2], {
      neither: () => 'neither',
      a: (a) => `a: ${a}`,
      b: (b) => `b: ${b}`,
      both: (a, b) => `both: ${a}, ${b}`,
    });

    expect(result).toBe('b: 2');
  });

  it("should return 'both' case when both values are defined", () => {
    const result = matchPair([3, 4], {
      neither: () => 'neither',
      a: (a) => `a: ${a}`,
      b: (b) => `b: ${b}`,
      both: (a, b) => `both: ${a}, ${b}`,
    });

    expect(result).toBe('both: 3, 4');
  });
});
