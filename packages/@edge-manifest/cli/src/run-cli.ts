import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import * as pc from 'picocolors';
import { build } from 'esbuild';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';

import type { EdgeManifest } from '@edge-manifest/core';
import { validateManifest } from '@edge-manifest/core';
import {
  generateAll,
  generateMigrations,
  generateRollback,
} from '@edge-manifest/generators';

type Command =
  | 'detect'
  | 'generate'
  | 'migrate:generate'
  | 'migrate:up'
  | 'dev'
  | 'deploy'
  | 'help'
  | 'version';

export async function runCli(argv: string[]): Promise<void> {
  const [maybeCommand, ...rest] = argv;

  if (!maybeCommand || maybeCommand === '--help' || maybeCommand === '-h') {
    printHelp();
    return;
  }

  if (maybeCommand === '--version' || maybeCommand === '-v') {
    printVersion();
    return;
  }

  const command = normalizeCommand(maybeCommand);

  switch (command) {
    case 'help':
      printHelp();
      return;
    case 'version':
      printVersion();
      return;
    case 'detect':
      await cmdDetect(rest);
      return;
    case 'generate':
      await cmdGenerate(rest);
      return;
    case 'migrate:generate':
      await cmdMigrateGenerate(rest);
      return;
    case 'migrate:up':
      await cmdMigrateUp(rest);
      return;
    case 'dev':
      await cmdWrangler(rest, 'dev');
      return;
    case 'deploy':
      await cmdWrangler(rest, 'deploy');
      return;
    default:
      printHelp();
  }
}

function normalizeCommand(value: string): Command {
  const normalized = value.trim();

  if (normalized === 'detect') return 'detect';
  if (normalized === 'generate') return 'generate';
  if (normalized === 'migrate:generate') return 'migrate:generate';
  if (normalized === 'migrate:up') return 'migrate:up';
  if (normalized === 'dev') return 'dev';
  if (normalized === 'deploy') return 'deploy';

  if (normalized === 'help') return 'help';
  if (normalized === 'version') return 'version';

  return 'help';
}

async function cmdDetect(argv: string[]): Promise<void> {
  const {
    values: { dir },
  } = parseArgs({
    args: argv,
    options: {
      dir: {
        type: 'string',
        short: 'd',
        default: process.cwd(),
      },
    },
    allowPositionals: true,
  });

  const rootDir = path.resolve(dir ?? process.cwd());
  const matches = await findManifestCandidates(rootDir);

  if (matches.length === 0) {
    process.stdout.write(`${pc.red('✗')} No manifest files found in ${rootDir}\n`);
    process.stdout.write(`Try: edge-manifest detect --dir ./examples\n`);
    return;
  }

  process.stdout.write(`${pc.green('✓')} Found ${matches.length} manifest file(s):\n`);
  for (const file of matches) {
    process.stdout.write(`  - ${path.relative(process.cwd(), file)}\n`);
  }
}

async function cmdGenerate(argv: string[]): Promise<void> {
  const {
    positionals,
    values: { manifest, out },
  } = parseArgs({
    args: argv,
    options: {
      manifest: {
        type: 'string',
        short: 'm',
      },
      out: {
        type: 'string',
        short: 'o',
      },
    },
    allowPositionals: true,
  });

  const repoRoot = await findRepoRoot(process.cwd());
  const starterDir = path.join(repoRoot, 'packages/@edge-manifest/starter');
  const outputDir = path.resolve(out ?? path.join(starterDir, 'generated'));

  const manifestPath = await resolveManifestPath({ repoRoot, manifestPath: manifest });
  const edgeManifest = await loadManifest(manifestPath);

  const targets = positionals.length > 0 ? positionals : ['all'];

  if (targets.includes('migrations')) {
    await writeMigrations(edgeManifest, path.join(starterDir, 'migrations'));
  }

  if (targets.includes('all')) {
    const result = await generateAll(edgeManifest);
    await fs.mkdir(outputDir, { recursive: true });

    await fs.writeFile(path.join(outputDir, 'schema.ts'), result.schema, 'utf-8');
    await fs.writeFile(path.join(outputDir, 'zod-schemas.ts'), result.zodSchemas, 'utf-8');
    await fs.writeFile(path.join(outputDir, 'types.ts'), result.types, 'utf-8');
    await fs.writeFile(path.join(outputDir, 'api-types.ts'), result.apiTypes, 'utf-8');
    await fs.writeFile(path.join(outputDir, 'routes.ts'), result.routes, 'utf-8');
    await fs.writeFile(path.join(outputDir, 'typebox-schemas.ts'), result.typeBoxSchemas, 'utf-8');
    await fs.writeFile(path.join(outputDir, 'migrations.sql'), result.migrations, 'utf-8');
    await fs.writeFile(path.join(outputDir, 'rollback.sql'), result.rollback, 'utf-8');

    await fs.mkdir(path.join(outputDir, 'admin/routes'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'admin/components'), { recursive: true });

    for (const [name, content] of Object.entries(result.admin.routes)) {
      await fs.writeFile(path.join(outputDir, 'admin/routes', name), content, 'utf-8');
    }

    for (const [name, content] of Object.entries(result.admin.components)) {
      await fs.writeFile(path.join(outputDir, 'admin/components', name), content, 'utf-8');
    }

    process.stdout.write(`${pc.green('✓')} Generated artifacts in ${path.relative(process.cwd(), outputDir)}\n`);
  }
}

async function cmdMigrateGenerate(argv: string[]): Promise<void> {
  const {
    values: { manifest, out },
  } = parseArgs({
    args: argv,
    options: {
      manifest: {
        type: 'string',
        short: 'm',
      },
      out: {
        type: 'string',
        short: 'o',
      },
    },
    allowPositionals: true,
  });

  const repoRoot = await findRepoRoot(process.cwd());
  const starterDir = path.join(repoRoot, 'packages/@edge-manifest/starter');
  const outputDir = path.resolve(out ?? path.join(starterDir, 'migrations'));

  const manifestPath = await resolveManifestPath({ repoRoot, manifestPath: manifest });
  const edgeManifest = await loadManifest(manifestPath);

  await writeMigrations(edgeManifest, outputDir);
}

async function writeMigrations(manifest: EdgeManifest, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  const version = Date.now();
  const migration = await generateMigrations(manifest);
  const rollback = await generateRollback(manifest);

  const migrationFile = path.join(outputDir, `${version}.sql`);
  const rollbackFile = path.join(outputDir, `${version}.rollback.sql`);

  await fs.writeFile(migrationFile, migration, 'utf-8');
  await fs.writeFile(rollbackFile, rollback, 'utf-8');

  process.stdout.write(`${pc.green('✓')} Wrote migration: ${path.relative(process.cwd(), migrationFile)}\n`);
  process.stdout.write(`${pc.green('✓')} Wrote rollback:  ${path.relative(process.cwd(), rollbackFile)}\n`);
}

async function cmdMigrateUp(argv: string[]): Promise<void> {
  const {
    values: { dir, db, local },
  } = parseArgs({
    args: argv,
    options: {
      dir: { type: 'string' },
      db: { type: 'string' },
      local: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  const repoRoot = await findRepoRoot(process.cwd());
  const starterDir = path.join(repoRoot, 'packages/@edge-manifest/starter');
  const migrationsDir = path.resolve(dir ?? path.join(starterDir, 'migrations'));

  const dbName = db ?? (await readDefaultD1DatabaseName(starterDir));
  if (!dbName) {
    throw new Error(
      'Unable to determine D1 database name. Provide --db <database_name> or configure [[d1_databases]] in wrangler.toml.',
    );
  }

  const files = await listMigrationFiles(migrationsDir);
  if (files.length === 0) {
    process.stdout.write(`${pc.yellow('!')} No migrations found in ${migrationsDir}\n`);
    return;
  }

  process.stdout.write(`${pc.cyan('→')} Applying ${files.length} migration(s) to D1: ${dbName}\n`);

  for (const file of files) {
    const relative = path.relative(process.cwd(), file);
    process.stdout.write(`${pc.cyan('→')} wrangler d1 execute ${dbName} --file ${relative}${local ? ' --local' : ''}\n`);

    await runWrangler(starterDir, [
      'd1',
      'execute',
      dbName,
      '--file',
      file,
      ...(local ? ['--local'] : []),
    ]);
  }

  process.stdout.write(`${pc.green('✓')} Done\n`);
}

async function cmdWrangler(argv: string[], action: 'dev' | 'deploy'): Promise<void> {
  const {
    values: { manifest, config },
  } = parseArgs({
    args: argv,
    options: {
      manifest: { type: 'string', short: 'm' },
      config: { type: 'string', short: 'c' },
    },
    allowPositionals: true,
  });

  const repoRoot = await findRepoRoot(process.cwd());
  const starterDir = path.join(repoRoot, 'packages/@edge-manifest/starter');

  const configPath = path.resolve(config ?? path.join(starterDir, 'wrangler.toml'));

  const manifestPath = await resolveManifestPath({ repoRoot, manifestPath: manifest });
  const edgeManifest = await loadManifest(manifestPath);
  const manifestJson = JSON.stringify(edgeManifest);

  const wranglerArgs = [action, '--config', configPath];

  process.stdout.write(`${pc.cyan('→')} Running wrangler ${action} (${path.relative(process.cwd(), configPath)})\n`);

  await runWrangler(starterDir, wranglerArgs, {
    EDGE_MANIFEST: manifestJson,
  });
}

async function runWrangler(
  cwd: string,
  wranglerArgs: string[],
  envOverrides: Record<string, string> = {},
): Promise<void> {
  await runCommand('pnpm', ['-C', cwd, 'exec', 'wrangler', ...wranglerArgs], {
    env: {
      ...process.env,
      ...envOverrides,
    },
  });
}

async function runCommand(
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: options.env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function listMigrationFiles(migrationsDir: string): Promise<string[]> {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(migrationsDir, entry.name))
    .filter((file) => file.endsWith('.sql') && !file.endsWith('.rollback.sql'))
    .sort();
}

async function readDefaultD1DatabaseName(starterDir: string): Promise<string | undefined> {
  const configPath = path.join(starterDir, 'wrangler.toml');
  try {
    const tomlText = await fs.readFile(configPath, 'utf-8');
    const parsed = parseToml(tomlText) as any;
    const db = parsed?.d1_databases?.[0];
    const name: unknown = db?.database_name;

    if (typeof name === 'string' && name.trim()) return name;
    return undefined;
  } catch {
    return undefined;
  }
}

async function resolveManifestPath({
  repoRoot,
  manifestPath,
}: {
  repoRoot: string;
  manifestPath?: string;
}): Promise<string> {
  if (manifestPath) {
    const full = path.resolve(manifestPath);
    await assertFileExists(full, `Manifest file not found: ${full}`);
    return full;
  }

  const candidates = await findManifestCandidates(repoRoot);
  if (candidates.length === 0) {
    throw new Error(
      `No manifest file found. Create manifest.json/edge-manifest.json or pass --manifest <path>. (Searched in: ${repoRoot})`,
    );
  }

  if (candidates.length > 1) {
    process.stdout.write(`${pc.yellow('!')} Multiple manifests found; using first. Use --manifest to choose:\n`);
    for (const file of candidates) {
      process.stdout.write(`  - ${path.relative(process.cwd(), file)}\n`);
    }
  }

  return candidates[0];
}

async function loadManifest(filePath: string): Promise<EdgeManifest> {
  const ext = path.extname(filePath).toLowerCase();

  let manifestLike: unknown;

  if (ext === '.json') {
    manifestLike = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } else if (ext === '.yml' || ext === '.yaml') {
    manifestLike = parseYaml(await fs.readFile(filePath, 'utf-8'));
  } else if (ext === '.ts' || ext === '.mts') {
    manifestLike = await loadTypeScriptManifest(filePath);
  } else {
    throw new Error(`Unsupported manifest extension: ${ext}`);
  }

  return validateManifest(manifestLike);
}

async function loadTypeScriptManifest(filePath: string): Promise<unknown> {
  const result = await build({
    entryPoints: [filePath],
    bundle: true,
    platform: 'node',
    format: 'esm',
    sourcemap: 'inline',
    write: false,
  });

  const code = result.outputFiles?.[0]?.text;
  if (!code) {
    throw new Error('Failed to compile manifest.ts');
  }

  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), '.edge-manifest-'));
  const outFile = path.join(tmpDir, 'manifest.mjs');
  await fs.writeFile(outFile, code, 'utf-8');

  try {
    const mod = await import(pathToFileURL(outFile).toString());
    if (mod?.default) return mod.default;
    if (mod?.manifest) return mod.manifest;

    const first = Object.values(mod ?? {})[0];
    if (first) return first;

    throw new Error('manifest.ts did not export a manifest (default export recommended)');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function findManifestCandidates(rootDir: string): Promise<string[]> {
  const candidates: string[] = [];

  const patterns = [
    'edge-manifest.json',
    'edge-manifest.yaml',
    'edge-manifest.yml',
    'edge-manifest.ts',
    'manifest.json',
    'manifest.yaml',
    'manifest.yml',
    'manifest.ts',
  ];

  const dirs = [rootDir, path.join(rootDir, 'config'), path.join(rootDir, 'examples')];

  for (const dir of dirs) {
    for (const name of patterns) {
      const p = path.join(dir, name);
      if (await exists(p)) {
        candidates.push(p);
      }
    }
  }

  return [...new Set(candidates)];
}

async function findRepoRoot(startDir: string): Promise<string> {
  let current = path.resolve(startDir);

  while (true) {
    if (await exists(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) return startDir;
    current = parent;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertFileExists(filePath: string, message: string): Promise<void> {
  if (!(await exists(filePath))) {
    throw new Error(message);
  }
}

function printHelp(): void {
  const lines = [
    `${pc.bold('edge-manifest')} – manifest-driven Cloudflare Worker tooling`,
    '',
    pc.bold('Usage:'),
    '  edge-manifest <command> [options]',
    '',
    pc.bold('Commands:'),
    '  detect                     Find manifest files (json/yaml/ts)',
    '  generate [targets...]      Generate artifacts (default: all)',
    '  migrate:generate           Generate SQL migration + rollback from manifest',
    '  migrate:up                 Apply migrations to D1 via wrangler',
    '  dev                        Run wrangler dev with EDGE_MANIFEST injected',
    '  deploy                     Run wrangler deploy with EDGE_MANIFEST injected',
    '',
    pc.bold('Options:'),
    '  -m, --manifest <path>      Path to manifest (json/yaml/ts)',
    '  -o, --out <dir>            Output directory (generate/migrate:generate)',
    '  --dir <dir>                Migrations directory (migrate:up)',
    '  --db <database_name>       D1 database name (migrate:up)',
    '  --local                    Use local D1 (migrate:up)',
    '  -c, --config <path>        Wrangler config path (dev/deploy)',
    '  -h, --help                 Show help',
    '  -v, --version              Show version',
    '',
  ];

  process.stdout.write(`${lines.join('\n')}\n`);
}

function printVersion(): void {
  process.stdout.write('0.0.0\n');
}
