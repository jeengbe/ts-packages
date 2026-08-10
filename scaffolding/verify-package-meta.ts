import { gray } from 'ansis';
import { readFile, writeFile } from 'node:fs/promises';
import type { Logger } from 'tsdown';
import { z } from 'zod';

const TAG = gray('[verify-package-meta]');

const DIST_MJS_PATH = /^\.\/dist\/(.+)\.mjs$/;

function distDefaultToSrcPath(defaultPath: string): string {
  const match = DIST_MJS_PATH.exec(defaultPath);

  if (!match) {
    throw new Error(`Expected export default to match ${DIST_MJS_PATH}, got: ${defaultPath}`);
  }

  return `./src/${match[1]}.ts`;
}

export async function verifyPackageMeta(logger: Logger, packageDir: URL): Promise<void> {
  const packageJson = await verifyPackageJson(logger, packageDir);

  await syncPackageJsonToJsr(logger, packageDir, packageJson);
}

async function verifyPackageJson(logger: Logger, packageDir: URL): Promise<PackageJson> {
  const packageJsonPath = new URL('package.json', packageDir);
  const raw: unknown = JSON.parse(await readFile(packageJsonPath, 'utf8'));

  const result = createPackageJsonSchema(packageDir).safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid package.json (${packageJsonPath.href}):\n${issues}`);
  }
  const packageJson = result.data;

  logger.success(`${TAG} Verified package.json`);

  return packageJson;
}

async function syncPackageJsonToJsr(
  logger: Logger,
  packageDir: URL,
  packageJson: PackageJson,
): Promise<void> {
  const jsrJsonPath = new URL('jsr.json', packageDir);

  const jsrJson = {
    $schema: 'https://jsr.io/schema/config-file.v1.json',
    name: packageJson.name,
    version: packageJson.version,
    license: packageJson.license,
    exports: Object.fromEntries(
      Object.entries(packageJson.exports).map(([key, value]) => [
        key,
        distDefaultToSrcPath(value.default),
      ]),
    ),
    publish: {
      include: ['src', 'README.md', 'LICENSE'],
    },
  };

  await writeFile(jsrJsonPath, `${JSON.stringify(jsrJson, null, 2)}\n`);

  logger.success(`${TAG} Synced package.json -> jsr.json`);
}

function createPackageJsonSchema(packageDir: URL) {
  // .../packages/<package-name>/
  const packageName = packageDir.pathname.split('/').at(-2);

  return z
    .object({
      name: z.literal(`@jeengbe/${packageName}`),
      version: z.string(),
      license: z.literal('MIT'),
      repository: z.object({
        type: z.literal('git'),
        url: z.literal('git+https://github.com/jeengbe/ts-packages.git'),
        directory: z.literal(`packages/${packageName}`),
      }),
      type: z.literal('module'),
      files: z
        .array(z.string())
        .refine(
          (files) => ['dist', 'src', '!src/**/*.spec.ts'].every((file) => files.includes(file)),
          {
            message: 'files must include dist, src, and !src/**/*.spec.ts',
          },
        ),
      main: z.literal('./dist/index.mjs'),
      typings: z.literal('./dist/index.d.mts'),
      exports: z.record(
        z.string(),
        z
          .object({
            types: z.string(),
            default: z.string(),
          })
          .refine((entry) => DIST_MJS_PATH.test(entry.default), {
            message: `default must match ${DIST_MJS_PATH}`,
            path: ['default'],
          })
          .refine((entry) => entry.types === entry.default.replace(/\.mjs$/, '.d.mts'), {
            message: 'types must be the .d.mts counterpart of default',
            path: ['types'],
          }),
      ),
    })
    .refine((pkg) => pkg.exports['.'] !== undefined, {
      message: 'exports must include a "." entry',
      path: ['exports'],
    })
    .refine((pkg) => pkg.main === pkg.exports['.']?.default, {
      message: 'main must match the "." export\'s default',
      path: ['main'],
    })
    .refine((pkg) => pkg.typings === pkg.exports['.']?.types, {
      message: 'typings must match the "." export\'s types',
      path: ['typings'],
    });
}

export type PackageJson = z.infer<ReturnType<typeof createPackageJsonSchema>>;
