
/**
 * Validates workspace dependency direction, deployable isolation, and dependency cycles.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_ROOTS = ['apps', 'packages'];
const SOURCE_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'];
const IGNORED_DIRECTORIES = new Set(['.next', 'coverage', 'dist', 'node_modules']);
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function discoverWorkspaces() {
  const workspaces = [];

  for (const workspaceRoot of WORKSPACE_ROOTS) {
    const rootPath = path.join(ROOT, workspaceRoot);
    for (const entry of await readdir(rootPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const directory = path.join(rootPath, entry.name);
      try {
        const manifest = await readJson(path.join(directory, 'package.json'));
        workspaces.push({
          directory,
          kind: workspaceRoot === 'apps' ? 'app' : 'package',
          manifest,
          name: manifest.name,
        });
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  return workspaces;
}

function workspaceDependencies(workspace, workspaceNames, { includeDevDependencies = true } = {}) {
  const sections = [
    workspace.manifest.dependencies,
    includeDevDependencies ? workspace.manifest.devDependencies : undefined,
    workspace.manifest.optionalDependencies,
    workspace.manifest.peerDependencies,
  ];

  return new Set(
    sections.flatMap((section) =>
      Object.keys(section ?? {}).filter((dependency) => workspaceNames.has(dependency)),
    ),
  );
}

function findCycles(graph) {
  const cycles = [];
  const active = [];
  const activeSet = new Set();
  const visited = new Set();

  function visit(node) {
    if (activeSet.has(node)) {
      const cycleStart = active.indexOf(node);
      cycles.push([...active.slice(cycleStart), node]);
      return;
    }
    if (visited.has(node)) {
      return;
    }

    active.push(node);
    activeSet.add(node);
    for (const dependency of graph.get(node) ?? []) {
      visit(dependency);
    }
    active.pop();
    activeSet.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) {
    visit(node);
  }

  return cycles;
}

async function collectSourceFiles(directory) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return files;
    }
    throw error;
  }

  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
    } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

function importsFrom(source) {
  return [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1] ?? match[2] ?? match[3]);
}

async function main() {
  const errors = [];
  const workspaces = await discoverWorkspaces();
  const workspaceByName = new Map(workspaces.map((workspace) => [workspace.name, workspace]));
  const workspaceNames = new Set(workspaceByName.keys());
  const appNames = new Set(
    workspaces.filter((workspace) => workspace.kind === 'app').map((workspace) => workspace.name),
  );
  const graph = new Map();

  for (const workspace of workspaces) {
    if (typeof workspace.name !== 'string') {
      errors.push(`${path.relative(ROOT, workspace.directory)} has no package name`);
      continue;
    }

    const dependencies = workspaceDependencies(workspace, workspaceNames);
    // Cycle detection is runtime-dependency-only: a devDependency (e.g. a
    // package's tests depending on another package that itself has a real
    // runtime dependency back on the first) is a legitimate, common pattern
    // that doesn't affect production bundling and isn't a boundary violation.
    graph.set(
      workspace.name,
      workspaceDependencies(workspace, workspaceNames, { includeDevDependencies: false }),
    );

    if (workspace.kind === 'app') {
      if (workspace.manifest.private !== true) {
        errors.push(`${workspace.name} must be private`);
      }
      for (const script of ['build', 'start']) {
        if (typeof workspace.manifest.scripts?.[script] !== 'string') {
          errors.push(`${workspace.name} must define an independent ${script} script`);
        }
      }
    }

    for (const dependency of dependencies) {
      if (appNames.has(dependency)) {
        errors.push(`${workspace.name} cannot depend on deployable application ${dependency}`);
      }
    }

    // Public web must never depend on server DB helpers.
    if (workspace.name === '@black-book/web' && dependencies.has('@black-book/data-access')) {
      errors.push(
        '@black-book/web cannot depend on @black-book/data-access (no browser DB credentials)',
      );
    }

    for (const file of await collectSourceFiles(path.join(workspace.directory, 'src'))) {
      const source = await readFile(file, 'utf8');
      for (const importedName of importsFrom(source)) {
        if (appNames.has(importedName)) {
          errors.push(
            `${path.relative(ROOT, file)} cannot import deployable application ${importedName}`,
          );
        }
        if (
          workspace.name === '@black-book/web' &&
          (importedName === '@black-book/data-access' ||
            importedName.startsWith('@black-book/data-access/'))
        ) {
          errors.push(
            `${path.relative(ROOT, file)} cannot import @black-book/data-access in the public web app`,
          );
        }
      }
    }

    // Package export contract: data-access must deny browser resolution.
    if (workspace.name === '@black-book/data-access') {
      const browserExport = workspace.manifest.exports?.['.']?.browser;
      if (!browserExport) {
        errors.push('@black-book/data-access must define exports["."].browser denial entry');
      }
    }
  }

  for (const cycle of findCycles(graph)) {
    errors.push(`workspace dependency cycle: ${cycle.join(' -> ')}`);
  }

  if (errors.length > 0) {
    console.error(`Boundary validation failed:\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Boundary validation passed for ${workspaces.length} workspaces; no dependency cycles found.`,
  );
}

await main();
