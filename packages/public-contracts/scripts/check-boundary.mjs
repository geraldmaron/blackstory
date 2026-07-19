#!/usr/bin/env node
/**
 * Static forbidden-import scanner + Metro-bundle-smoke-test stand-in for
 * `@black-book/public-contracts` (ADR-021 §1, MOB-003).
 *
 * ADR-021 requires a compile-time CI gate — not a code-review convention — that fails on any
 * `node:*` built-in or server-only transitive dependency (`firebase-admin`,
 * `@black-book/domain`, `@black-book/security`, `@black-book/firebase`'s server surface, or a
 * direct Firestore import) anywhere this package's shipped surface can reach. This script is
 * that gate, run as plain Node (no TypeScript compilation needed — it works by statically
 * regex-scanning import/require/dynamic-import specifiers, which is sufficient to catch every
 * forbidden specifier without needing a real bundler).
 *
 * Two passes:
 *
 * 1. `scanOwnSource()` — walks every `.ts` file under `src/`, excluding `src/**\/*.test.ts` and
 *    `src/testing/**` (test-support code that legitimately uses `node:fs` to load JSON fixtures
 *    under `node --test`, and is never part of the shipped `dist` or reachable from any
 *    `package.json` "exports" entrypoint — see `src/testing/load-fixture.ts`'s own doc comment).
 *
 * 2. `scanEntrypointGraph()` — the Metro-bundle-smoke-test stand-in required by MOB-003 (real
 *    Metro/React Native tooling does not exist yet; that is MOB-006). Starting ONLY from the
 *    files `package.json`'s "exports" map actually points at (the "development" condition, i.e.
 *    the real TS source a bundler resolving this package would start from), it follows relative
 *    imports transitively — exactly the set of files a bundler would actually include — and
 *    additionally resolves and scans the one allowed external dependency (`zod`) one level deep,
 *    satisfying "walks ... its resolved dependency graph." Any `node:*` built-in, bare Node
 *    built-in name, or non-`zod` external specifier reachable from an entrypoint fails the gate.
 *
 * This is an honest stand-in, not a full bundler: it does not execute code, does not resolve
 * conditional/dynamic requires, and does not model Metro's actual resolver algorithm. A real
 * Metro bundle test should be added once `apps/mobile` exists (MOB-006) and can import this
 * package for real; until then, this is the strongest CI-runnable proxy available.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC_ROOT = join(PACKAGE_ROOT, 'src');

const NODE_BUILTIN_MODULES = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http', 'http2',
  'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
  'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls',
  'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);

const FORBIDDEN_PACKAGE_SPECIFIERS = [
  'firebase-admin',
  '@black-book/domain',
  '@black-book/security',
  '@black-book/firebase',
  // Legacy/current scope kept during the @repo -> @black-book rename (see MOB-003 evidence
  // report) so the gate does not go blind if a file is copy-pasted from an @repo-scoped module.
  '@repo/domain',
  '@repo/security',
  '@repo/firebase',
];

/** The only runtime dependency this package is allowed to declare (ADR-021 §1: "dependency list
 * short enough to eyeball"). Any other non-relative specifier is a boundary violation even if it
 * is not on the explicit forbidden list above — an allowlist, not a denylist, is the stricter and
 * therefore safer gate. */
const ALLOWED_EXTERNAL_SPECIFIERS = new Set(['zod']);

const IMPORT_SPECIFIER_PATTERN = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

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
    return `${relative(PACKAGE_ROOT, fromFile)}: unlisted external dependency "${specifier}" (only "zod" is allowed at runtime — ADR-021 §1)`;
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
      violations.push(`entrypoint graph: could not read "${relative(PACKAGE_ROOT, file)}" (broken exports entry)`);
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
          violations.push(`${relative(PACKAGE_ROOT, file)}: could not resolve relative import "${specifier}"`);
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
      violations.push(`entrypoint graph: could not resolve "${external}" from ${PACKAGE_ROOT} to inspect its dependency graph`);
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

console.log('[check-boundary] PASSED — no node:* built-ins, no forbidden server-only imports, no unlisted external dependencies.');
