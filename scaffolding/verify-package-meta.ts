import { gray } from 'ansis';
import { readFile, writeFile } from 'node:fs/promises';
import type { Logger } from 'tsdown';
import { z } from 'zod';

const TAG = gray('[verify-package-meta]');

export async function verifyPackageMeta(logger: Logger, packageDir: URL): Promise<void> {
  const packageJson = await verifyPackageJson(logger, packageDir);

  await syncPackageJsonToJsr(logger, packageDir, packageJson);
}

async function verifyPackageJson(logger: Logger, packageDir: URL): Promise<PackageJson> {
  const packageJsonPath = new URL('package.json', packageDir);
  const raw: unknown = JSON.parse(await readFile(packageJsonPath, 'utf8'));

  const result = PackageJsonSchema.safeParse(raw);

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
    exports: Object.fromEntries(
      Object.entries(packageJson.exports).map(([key, value]) => [
        key,
        value.default.replace(/^\.\/dist\/(.*)\.mjs$/, './src/$1.ts'),
      ]),
    ),
    publish: {
      include: ['src', 'README.md', 'LICENSE'],
    },
  };

  await writeFile(jsrJsonPath, `${JSON.stringify(jsrJson, null, 2)}\n`);

  logger.success(`${TAG} Synced package.json -> jsr.json`);
}

const PackageJsonSchema = z.object({
  name: z.string().regex(/^@jeengbe\//, 'must start with @jeengbe/'),
  version: z.string(),
  license: z.literal('MIT'),
  type: z.literal('module'),
  files: z
    .array(z.string())
    .refine((files) => ['dist', 'src', '!src/**/*.spec.ts'].every((file) => files.includes(file)), {
      message: 'files must include dist, src, and !src/**/*.spec.ts',
    }),
  exports: z.record(
    z.string(),
    z
      .object({
        types: z.string(),
        default: z.string(),
      })
      .refine((entry) => entry.types.startsWith('./dist/'), {
        message: 'exports must point to a file in dist',
        path: [],
      })
      .refine((entry) => entry.types === entry.default.replace(/\.mjs$/, '.d.mts'), {
        message: 'types must be the .d.mts counterpart of default',
        path: ['types'],
      }),
  ),
});

export type PackageJson = z.infer<typeof PackageJsonSchema>;
