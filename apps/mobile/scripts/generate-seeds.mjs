/**
 * Single entrypoint for the mobile offline catalog seeds.
 *
 * The four `src/features/<x>/catalog-seed.json` files are generated build
 * artifacts, not hand-edited source. They stay committed on purpose: apps/mobile
 * is outside the pnpm workspace and its CI lane (`npm ci`, see
 * .github/workflows/ci.yml) has no workspace install, no built @repo/domain and
 * no DATABASE_URL, so typecheck and Jest need the JSON present on a clean
 * checkout. This script is what keeps "committed" from meaning "stale":
 *
 *   pnpm mobile:seeds          regenerate every seed in place
 *   pnpm mobile:seeds:check    fail if any committed seed differs from a fresh export
 *
 * Run from the repo root with DB env sourced (memorial reads Supabase):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *
 * `generatedAt` is ignored when comparing — it changes on every run and says
 * nothing about whether the content drifted.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

/** `needsDatabase` seeds read Supabase and are skipped when DATABASE_URL is absent. */
const SEEDS = [
  {
    name: 'books',
    script: 'export-banned-books-seed.mjs',
    out: 'src/features/books/catalog-seed.json',
    needsDatabase: false,
  },
  {
    name: 'law',
    script: 'export-law-seed.mjs',
    out: 'src/features/law/catalog-seed.json',
    needsDatabase: false,
  },
  {
    name: 'themes',
    script: 'export-themes-seed.mjs',
    out: 'src/features/themes/catalog-seed.json',
    needsDatabase: false,
  },
  {
    name: 'memorial',
    script: 'export-memorial-seed.mjs',
    out: 'src/features/memorial/catalog-seed.json',
    needsDatabase: true,
  },
];

const args = process.argv.slice(2);
const check = args.includes('--check');
const only = args.filter((arg) => !arg.startsWith('--'));
const hasDatabase = Boolean(
  process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim(),
);

const selected = only.length
  ? SEEDS.filter((seed) => only.includes(seed.name))
  : SEEDS;

const unknown = only.filter((name) => !SEEDS.some((seed) => seed.name === name));
if (unknown.length) {
  console.error(
    `Unknown seed(s): ${unknown.join(', ')}. Known: ${SEEDS.map((s) => s.name).join(', ')}`,
  );
  process.exit(2);
}

/** Strip the run timestamp so only real content differences are reported. */
function contentOf(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'generatedAt' in parsed) {
      delete parsed.generatedAt;
    }
    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
}

const skipped = [];
const drifted = [];
const failed = [];

for (const seed of selected) {
  const outPath = resolve(here, '..', seed.out);
  const rel = relative(repoRoot, outPath);

  if (seed.needsDatabase && !hasDatabase) {
    skipped.push(seed.name);
    console.log(
      `- ${seed.name}: skipped (needs DATABASE_URL; source apps/web/.env.local to include it)`,
    );
    continue;
  }

  const before = contentOf(outPath);
  let original = null;
  try {
    original = readFileSync(outPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const result = spawnSync(
    process.execPath,
    ['--conditions=development', '--import', 'tsx', resolve(here, seed.script)],
    { cwd: repoRoot, stdio: 'inherit', env: process.env },
  );

  if (result.status !== 0) {
    failed.push(seed.name);
    // Never leave a half-written artifact behind on failure.
    if (original !== null) writeFileSync(outPath, original);
    continue;
  }

  if (!check) continue;

  const after = contentOf(outPath);
  // Check mode must not mutate the working tree.
  if (original !== null) writeFileSync(outPath, original);

  if (before !== after) {
    drifted.push(rel);
  }
}

if (failed.length) {
  console.error(`\nExporter failed: ${failed.join(', ')}`);
  process.exit(1);
}

if (check) {
  if (drifted.length) {
    console.error(
      `\nCommitted seeds are stale:\n${drifted.map((f) => `  ${f}`).join('\n')}\n` +
        'Run `pnpm mobile:seeds` and commit the result.',
    );
    process.exit(1);
  }
  console.log(
    `\nAll checked seeds are current${skipped.length ? ` (skipped: ${skipped.join(', ')})` : ''}.`,
  );
  process.exit(0);
}

console.log(
  `\nGenerated ${selected.length - skipped.length} seed(s)${
    skipped.length ? `; skipped ${skipped.join(', ')}` : ''
  }.`,
);
