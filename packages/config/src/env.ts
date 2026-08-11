import type { EnvSpec, InferEnvSpec, Pretty } from './ast.js';
import { EnvNode, ScalarEnvNode } from './ast.js';
import type { ValidationResult } from './validation.js';
import { arrayIncludes, combineValidationResults } from './validation.js';
import { Either } from '@jeengbe/prelude';

export interface Env {
  string(key: string, defaultValue?: string): ScalarEnvNode<string>;
  number(key: string, defaultValue?: number): ScalarEnvNode<number>;
  boolean(key: string, defaultValue?: boolean): ScalarEnvNode<boolean>;
  enum<const T extends string>(
    key: string,
    values: readonly T[],
    defaultValue?: T,
  ): ScalarEnvNode<T>;
  custom<T>(
    key: string,
    transform: (value: string) => ValidationResult<T>,
    defaultValue?: T,
  ): ScalarEnvNode<T>;
  array<T>(itemType: ScalarEnvNode<T>, defaultValue?: readonly T[]): EnvNode<readonly T[]>;
  discriminate<
    K extends string,
    V extends string,
    M extends Partial<Record<V, Record<string, EnvSpec>>>,
  >(
    discriminatorKey: K,
    discriminatorValueType: ScalarEnvNode<V>,
    mapping: M,
  ): EnvNode<DiscriminatorResult<K, V, M>>;
  load<S extends EnvSpec>(spec: S): Pretty<InferEnvSpec<S>>;
}

export const env: Env = {
  string(key, defaultValue) {
    return env.custom(key, (value) => Either.right(value), defaultValue);
  },

  number(key, defaultValue) {
    return env.custom(
      key,
      (value) => {
        if (/^-?\d+(?:\.\d+)?$/.test(value)) {
          return Either.right(Number(value));
        }

        return Either.left(['invalid number']);
      },
      defaultValue,
    );
  },

  boolean(key, defaultValue) {
    return env.custom(
      key,
      (value) => {
        if (value.toLowerCase() === 'true') return Either.right(true);
        if (value.toLowerCase() === 'false') return Either.right(false);

        return Either.left(["invalid boolean (must be 'true' or 'false')"]);
      },
      defaultValue,
    );
  },

  enum(key, values, defaultValue) {
    return env.custom(
      key,
      (value) => {
        if (arrayIncludes(values, value)) return Either.right(value);

        return Either.left([
          `invalid enum value (must be one of: ${values.map((v) => `'${v}'`).join(', ')})`,
        ]);
      },
      defaultValue,
    );
  },

  custom(key, transform, defaultValue) {
    return new ScalarEnvNode(key, (value) => {
      if (value === undefined) {
        if (defaultValue !== undefined) return Either.right(defaultValue);
        return Either.left(['required']);
      }

      return transform(value);
    });
  },

  array<T>(itemType: ScalarEnvNode<T>, defaultValue?: readonly T[]): EnvNode<readonly T[]> {
    return new EnvNode((path, loadValue) => {
      const value = loadValue(itemType.key);
      if (value === undefined) {
        if (defaultValue !== undefined) return Either.right(defaultValue);
        return Either.left([`${itemType.key} (${path}): required`]);
      }
      if (value === '') return Either.right([]);

      return combineValidationResults(
        ...value
          .split(',')
          .map((v) => v.trim() || undefined)
          .map((v, i) =>
            itemType.validate(`${path}.${i}`, (k) => (k === itemType.key ? v : undefined)),
          ),
      );
    });
  },

  discriminate<
    K extends string,
    V extends string,
    M extends Partial<Record<V, Record<string, EnvSpec>>>,
  >(
    discriminatorKey: K,
    discriminatorValueType: ScalarEnvNode<V>,
    mapping: M,
  ): EnvNode<DiscriminatorResult<K, V, M>> {
    return new EnvNode((path, loadValue) => {
      return discriminatorValueType.validate(path, loadValue).flatMap((discriminatorValue) => {
        return resolveNode<NonNullable<M[keyof M]> | {}>(
          path,
          mapping[discriminatorValue] ?? {},
          loadValue,
        ).map(
          (mappingValues) =>
            ({
              [discriminatorKey]: discriminatorValue,
              ...mappingValues,
            }) as DiscriminatorResult<K, V, M>,
        );
      });
    });
  },

  load(spec) {
    return resolveNode('$', spec, (key) => process.env[key]?.trim() || undefined).getOrElse(
      (errors) => {
        throw new Error(`Failed to load config: ${errors.join(', ')}`);
      },
    );
  },
};

type DiscriminatorResult<
  K extends string,
  V extends string,
  M extends Partial<Record<V, Record<string, EnvSpec>>>,
> = Pretty<
  // This "redundant" condition is necessary to make sure that 'DiscriminatorResult' distributes over
  // the union type V
  V extends unknown ? Record<K, V> & InferEnvSpec<M[V] extends EnvSpec ? M[V] : {}> : never
>;

function resolveNode<S extends EnvSpec>(
  path: string,
  spec: S,
  loadValue: (key: string) => string | undefined,
): ValidationResult<Pretty<InferEnvSpec<S>>> {
  if (spec instanceof EnvNode) {
    return (spec as EnvNode<Pretty<InferEnvSpec<S>>>).validate(path, loadValue);
  }

  return combineValidationResults(
    ...Object.entries(spec).map(([key, value]) =>
      resolveNode(`${path}.${key}`, value, loadValue).map((v) => [key, v] as const),
    ),
  ).map((entries) => Object.fromEntries(entries) as Pretty<InferEnvSpec<S>>);
}
