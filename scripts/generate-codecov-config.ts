import { readdir, readFile, writeFile } from 'node:fs/promises';
import { stringify } from 'yaml';

const packagesDir = new URL('../packages/', import.meta.url);
const codecovYmlPath = new URL('../codecov.yml', import.meta.url);

async function getPackageDirs(): Promise<readonly string[]> {
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const dirs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const packageJsonUrl = new URL(`${entry.name}/package.json`, packagesDir);
    const packageJson = JSON.parse(await readFile(packageJsonUrl, 'utf8')) as {
      private?: boolean;
    };

    if (packageJson.private) continue;

    dirs.push(entry.name);
  }

  return dirs.toSorted();
}

async function main(): Promise<void> {
  const dirs = await getPackageDirs();

  const config = {
    coverage: {
      status: {
        project: {
          default: {
            target: 'auto',
            threshold: '1%',
          },
        },
        patch: {
          default: {
            target: 'auto',
          },
        },
      },
    },
    component_management: {
      default_rules: {
        statuses: [{ type: 'project', target: 'auto' }],
      },
      individual_components: dirs.map((dir) => ({
        component_id: dir,
        name: dir,
        paths: [`packages/${dir}`],
      })),
    },
    comment: {
      layout: 'condensed_header, components, condensed_files, condensed_footer',
      require_changes: false,
    },
  };

  await writeFile(codecovYmlPath, stringify(config));
}

await main();
