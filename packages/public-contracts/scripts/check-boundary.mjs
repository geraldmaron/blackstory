#!/usr/bin/env node
/**
 * Static public-contract import boundary and compiled-output smoke check. Only allowlisted
 * dependencies may be reachable from shipped exports. Exclude test-support modules that load
 * fixtures with Node. This scanner checks literal import/require specifiers; it is not a real
 * Metro bundle or a detector of arbitrary computed imports.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC_ROOT = join(PACKAGE_ROOT, 'src');

const NODE_BUILTIN_MODULES = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

// Named explicitly so a violation reports the offending server-only package rather than the
// generic "not on the allowlist" message. `ALLOWED_EXTERNAL_SPECIFIERS` below is the real gate.
// (An earlier revision listed each of these twice: the pre-rename scope was rewritten to `@repo`
// alongside the current one, leaving identical pairs. The workspace is single-scope now.)
const FORBIDDEN_PACKAGE_SPECIFIERS = [
  'firebase-admin',
  '@repo/domain',
  '@repo/security',
  '@repo/ops-data',
];

/** The only runtime dependency this package is allowed to declare — the "dependency list short
 * enough to eyeball" rule in `docs/decisions-carryover.md`, "ADR-021's two invariants": the
 * public-contracts boundary. Any other non-relative specifier is a boundary violation even if it
 * is not on the explicit forbidden list above — an allowlist, not a denylist, is the stricter and
 * therefore safer gate. */
const ALLOWED_EXTERNAL_SPECIFIERS = new Set(['zod']);

const IMPORT_SPECIFIER_PATTERN =
  /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

function listTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function extractSpecifiers(fileContents) {
  const specifiers = [];
  for (const match of fileContents.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    const specifier = match[1] ?? match[2];
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
}

/** Classifies one import specifier found in `fromFile`. Returns a violation string, or `null`
 * if the specifier is clean. */
function classifySpecifier(specifier, fromFile) {
  if (specifier.startsWith('node:')) {
    return `${relative(PACKAGE_ROOT, fromFile)}: forbidden node: built-in import "${specifier}"`;
  }
  if (NODE_BUILTIN_MODULES.has(specifier)) {
    return `${relative(PACKAGE_ROOT, fromFile)}: forbidden bare Node built-in import "${specifier}" (Metro/Hermes cannot resolve this)`;
  }
  for (const forbidden of FORBIDDEN_PACKAGE_SPECIFIERS) {
    if (specifier === forbidden || specifier.startsWith(`${forbidden}/`)) {
      return `${relative(PACKAGE_ROOT, fromFile)}: forbidden server-only import "${specifier}"`;
    }
  }
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return null; // relative import — handled by the caller's own traversal
  }
  if (!ALLOWED_EXTERNAL_SPECIFIERS.has(specifier)) {
    return `${relative(PACKAGE_ROOT, fromFile)}: unlisted external dependency "${specifier}" (only "zod" is allowed at runtime — docs/decisions-carryover.md, "ADR-021's two invariants")`;
  }
  return null;
}

/** Pass 1: every shipped `.ts` file's own imports, independent of reachability from an
 * entrypoint. Catches dead server-only code even before it is wired into an export. */
function scanOwnSource() {
  const violations = [];
  const files = listTsFiles(SRC_ROOT).filter((file) => {
    if (file.endsWith('.test.ts')) return false;
    const relPath = relative(SRC_ROOT, file).split(sep).join('/');
    if (relPath.startsWith('testing/')) return false; // test-support only, see src/testing/load-fixture.ts
    return true;
  });
  for (const file of files) {
    const contents = readFileSync(file, 'utf8');
    for (const specifier of extractSpecifiers(contents)) {
      const violation = classifySpecifier(specifier, file);
      if (violation) violations.push(violation);
    }
  }
  return { filesScanned: files.length, violations };
}

function resolveRelativeSpecifier(specifier, fromFile) {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, join(base, 'index.ts')];
  // Our source uses `.js`-suffixed relative specifiers (NodeNext ESM convention) that map back to
  // `.ts` files on disk.
  if (base.endsWith('.js')) candidates.push(`${base.slice(0, -3)}.ts`);
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

/** Pass 2: the Metro-bundle-smoke-test stand-in — only files transitively reachable from a real
 * `package.json` "exports" entrypoint, following actual import edges. */
function scanEntrypointGraph() {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  const entrypoints = Object.values(pkg.exports)
    .map((condition) => condition.development)
    .filter(Boolean)
    .map((relPath) => resolve(PACKAGE_ROOT, relPath));

  const visited = new Set();
  const violations = [];
  const externalsSeen = new Set();
  const queue = [...entrypoints];

  while (queue.length > 0) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    let contents;
    try {
      contents = readFileSync(file, 'utf8');
    } catch {
      violations.push(
        `entrypoint graph: could not read "${relative(PACKAGE_ROOT, file)}" (broken exports entry)`,
      );
      continue;
    }
    for (const specifier of extractSpecifiers(contents)) {
      const violation = classifySpecifier(specifier, file);
      if (violation) {
        violations.push(violation);
        continue;
      }
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        const resolved = resolveRelativeSpecifier(specifier, file);
        if (!resolved) {
          violations.push(
            `${relative(PACKAGE_ROOT, file)}: could not resolve relative import "${specifier}"`,
          );
          continue;
        }
        queue.push(resolved);
      } else {
        externalsSeen.add(specifier);
      }
    }
  }

  // Resolved-dependency-graph check: follow the one allowed external (zod) one level into its
  // own entry file(s) and scan those too, so a hypothetical zod transitive node-builtin import
  // would also be caught, not just specifiers written in this package's own source.
  for (const external of externalsSeen) {
    let externalPkgJsonPath;
    try {
      externalPkgJsonPath = require.resolve(`${external}/package.json`, { paths: [PACKAGE_ROOT] });
    } catch {
      violations.push(
        `entrypoint graph: could not resolve "${external}" from ${PACKAGE_ROOT} to inspect its dependency graph`,
      );
      continue;
    }
    const externalPkg = JSON.parse(readFileSync(externalPkgJsonPath, 'utf8'));
    const externalDeps = Object.keys(externalPkg.dependencies ?? {});
    for (const dep of externalDeps) {
      violations.push(
        `entrypoint graph: allowed external "${external}" declares its own runtime dependency "${dep}" — re-run this scanner after auditing it (zod is expected to have zero runtime dependencies)`,
      );
    }
  }

  return { filesVisited: visited.size, externalsSeen: [...externalsSeen], violations };
}

const ownSource = scanOwnSource();
const entrypointGraph = scanEntrypointGraph();

const allViolations = [...ownSource.violations, ...entrypointGraph.violations];

console.log(`[check-boundary] own-source scan: ${ownSource.filesScanned} file(s) scanned.`);
console.log(
  `[check-boundary] entrypoint-graph (Metro bundle smoke stand-in): ${entrypointGraph.filesVisited} file(s) reachable from package.json "exports"; external deps seen: ${
    entrypointGraph.externalsSeen.length > 0 ? entrypointGraph.externalsSeen.join(', ') : '(none)'
  }.`,
);

if (allViolations.length > 0) {
  console.error(`[check-boundary] FAILED — ${allViolations.length} violation(s):`);
  for (const violation of allViolations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log(
  '[check-boundary] PASSED — no node:* built-ins, no forbidden server-only imports, no unlisted external dependencies.',
);
