<h1 align="center">ts-packages</h1>
<div align="center">

A monorepo of small, strongly-typed TypeScript packages published to npm and JSR.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/jeengbe/ts-packages/actions/workflows/ci.yml/badge.svg)](https://github.com/jeengbe/ts-packages/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/jeengbe/ts-packages/graph/badge.svg)](https://codecov.io/gh/jeengbe/ts-packages)

</div>

## Packages

<!-- packages:start -->

| Package                                | Version                                                                                                                                                                                   | Coverage                                                                                                                                                                             | Description                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [`@jeengbe/cache`](packages/cache)     | [![npm](https://img.shields.io/npm/v/@jeengbe/cache)](https://www.npmjs.com/package/@jeengbe/cache) [![JSR](https://jsr.io/badges/@jeengbe/cache)](https://jsr.io/@jeengbe/cache)         | [![Coverage](https://codecov.io/gh/jeengbe/ts-packages/branch/master/graph/badge.svg?component=cache)](https://app.codecov.io/gh/jeengbe/ts-packages/tree/master/packages/cache)     | A strongly typed TypeScript caching framework that works with any engine, with in-memory and Redis adapters included. |
| [`@jeengbe/config`](packages/config)   | [![npm](https://img.shields.io/npm/v/@jeengbe/config)](https://www.npmjs.com/package/@jeengbe/config) [![JSR](https://jsr.io/badges/@jeengbe/config)](https://jsr.io/@jeengbe/config)     | [![Coverage](https://codecov.io/gh/jeengbe/ts-packages/branch/master/graph/badge.svg?component=config)](https://app.codecov.io/gh/jeengbe/ts-packages/tree/master/packages/config)   | A declarative, strongly typed schema for parsing and validating environment variables in TypeScript.                  |
| [`@jeengbe/prelude`](packages/prelude) | [![npm](https://img.shields.io/npm/v/@jeengbe/prelude)](https://www.npmjs.com/package/@jeengbe/prelude) [![JSR](https://jsr.io/badges/@jeengbe/prelude)](https://jsr.io/@jeengbe/prelude) | [![Coverage](https://codecov.io/gh/jeengbe/ts-packages/branch/master/graph/badge.svg?component=prelude)](https://app.codecov.io/gh/jeengbe/ts-packages/tree/master/packages/prelude) | A small, dependency-free functional programming toolkit for TypeScript.                                               |
| [`@jeengbe/spiffe`](packages/spiffe)   | [![npm](https://img.shields.io/npm/v/@jeengbe/spiffe)](https://www.npmjs.com/package/@jeengbe/spiffe) [![JSR](https://jsr.io/badges/@jeengbe/spiffe)](https://jsr.io/@jeengbe/spiffe)     | [![Coverage](https://codecov.io/gh/jeengbe/ts-packages/branch/master/graph/badge.svg?component=spiffe)](https://app.codecov.io/gh/jeengbe/ts-packages/tree/master/packages/spiffe)   | A TypeScript library for working with SPIFFE workload identities.                                                     |

<!-- packages:end -->

Each package has its own README with installation and usage instructions. All packages are also published to [JSR](https://jsr.io/@jeengbe).

## Development

| Command              | Description                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| `pnpm build`         | Build all packages                                                     |
| `pnpm test`          | Run tests for all packages                                             |
| `pnpm test:coverage` | Run tests with coverage                                                |
| `pnpm lint`          | Lint and format, fixing what can be auto-fixed                         |
| `pnpm lint:readonly` | Lint and format check without making changes (used in CI)              |
| `pnpm docs:packages` | Regenerate the packages table below from each package's `package.json` |

Shared tooling config (`tsconfig`, `oxlint`, `oxfmt`, `vitest`, `tsdown`) lives in [`scaffolding`](scaffolding) and is extended by every package.

Releases are managed with Changesets: run `pnpm changeset` to describe a change, and CI opens a version PR that publishes to npm and JSR once merged.

## License

[MIT](LICENSE) Jesper Engberg
