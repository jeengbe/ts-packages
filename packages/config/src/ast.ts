import type { ValidationResult } from './validation.js';
import { Either } from '@jeengbe/prelude';

const nodeType = Symbol('type');

export class EnvNode<T> {
  declare private readonly [nodeType]: T;

  constructor(
    readonly validate: (
      path: string,
      loadValue: (key: string) => string | undefined,
    ) => ValidationResult<T>,
  ) {}

  transform<U>(transform: (value: T) => ValidationResult<U>): EnvNode<U> {
    return new EnvNode((path, loadValue) => this.validate(path, loadValue).flatMap(transform));
  }
}

export class ScalarEnvNode<T> extends EnvNode<T> {
  constructor(
    readonly key: string,
    private readonly validateValue: (value: string | undefined) => ValidationResult<T>,
  ) {
    super((path, loadValue) => {
      return validateValue(loadValue(key)).leftMap((errors) =>
        errors.map((error) => `${key} (${path}): ${error}`),
      );
    });
  }

  optional(): ScalarEnvNode<T | undefined> {
    return new ScalarEnvNode<T | undefined>(this.key, (value) =>
      value === undefined ? Either.right(undefined) : this.validateValue(value),
    );
  }

  override transform<U>(transform: (value: T) => ValidationResult<U>): ScalarEnvNode<U> {
    return new ScalarEnvNode(this.key, (value) => this.validateValue(value).flatMap(transform));
  }
}

export type EnvSpec = EnvNode<unknown> | { [key: string]: EnvSpec };

export type InferEnvSpec<T extends EnvSpec> =
  T extends EnvNode<infer U>
    ? U
    : T extends Record<string, EnvSpec>
      ? { [K in keyof T]: InferEnvSpec<T[K]> }
      : never;

export type Pretty<T> = T extends infer U extends object ? { [K in keyof U]: Pretty<U[K]> } : T;
