import { readdir, readFile, writeFile } from 'node:fs/promises';

const START_MARKER = '<!-- packages:start -->';
const END_MARKER = '<!-- packages:end -->';

interface PackageInfo {
  name: string;
  description: string;
  dir: string;
}

const packagesDir = new URL('../packages/', import.meta.url);
const readmePath = new URL('../README.md', import.meta.url);

async function getPackages(): Promise<readonly PackageInfo[]> {
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const packages: PackageInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const packageJsonUrl = new URL(`${entry.name}/package.json`, packagesDir);
    const packageJson = JSON.parse(await readFile(packageJsonUrl, 'utf8')) as {
      name: string;
      description?: string;
      private?: boolean;
    };

    if (packageJson.private) continue;

    if (!packageJson.description) {
      throw new Error(`${packageJson.name}: missing "description" in package.json`);
    }

    packages.push({
      name: packageJson.name,
      description: packageJson.description,
      dir: entry.name,
    });
  }

  return packages.toSorted((a, b) => a.name.localeCompare(b.name));
}

function renderTable(packages: readonly PackageInfo[]): string {
  const rows = packages.map((pkg) => {
    const description = pkg.description.replaceAll('|', '\\|');

    return `| [\`${pkg.name}\`](packages/${pkg.dir}) | [![npm](https://img.shields.io/npm/v/${pkg.name})](https://www.npmjs.com/package/${pkg.name}) [![JSR](https://jsr.io/badges/${pkg.name})](https://jsr.io/${pkg.name}) | ${description} |`;
  });

  return ['| Package | Version | Description |', '| --- | --- | --- |', ...rows].join('\n');
}

async function main(): Promise<void> {
  const packages = await getPackages();
  const table = renderTable(packages);

  const readme = await readFile(readmePath, 'utf8');

  const startIndex = readme.indexOf(START_MARKER);
  const endIndex = readme.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`README.md is missing the ${START_MARKER} / ${END_MARKER} markers`);
  }

  const updated = `${readme.slice(0, startIndex + START_MARKER.length)}\n\n${table}\n\n${readme.slice(endIndex)}`;

  await writeFile(readmePath, updated);
}

await main();
