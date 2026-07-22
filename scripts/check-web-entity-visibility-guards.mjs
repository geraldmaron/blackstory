/**
 * Static guards that catch the recurring “entities missing in local dig” failure modes:
 * duplicate `/explore` (or homepage) route ownership, and `export const dynamic` placed
 * between imports (breaks RSC / Next module evaluation).
 *
 * Run via `pnpm check:web-entity-visibility` or as part of `pnpm validate`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = path.join(ROOT, 'apps/web/src/app');

/** @param {string} dir */
function walkFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** @param {string} filePath */
function relativeAppPath(filePath) {
  return path.relative(APP_DIR, filePath).split(path.sep).join('/');
}

/**
 * `export const dynamic = …` must appear after every top-level import.
 * Placing it between imports previously broke the entity RSC module.
 * @param {string} source
 * @param {string} label
 */
function assertDynamicAfterImports(source, label) {
  const lines = source.split(/\r?\n/);
  let lastImportLine = -1;
  let dynamicLine = -1;
  let importAfterDynamic = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const trimmed = line.trimStart();
    const isImport =
      /^import\s/.test(trimmed) ||
      /^import["']/.test(trimmed) ||
      /^import\{/.test(trimmed);
    const isDynamic = /^export\s+const\s+dynamic\s*=/.test(trimmed);

    if (isImport) {
      lastImportLine = i;
      if (dynamicLine >= 0) importAfterDynamic = true;
    }
    if (isDynamic) {
      if (dynamicLine >= 0) {
        throw new Error(`${label}: multiple export const dynamic declarations`);
      }
      dynamicLine = i;
    }
  }

  if (dynamicLine < 0) {
    throw new Error(`${label}: missing export const dynamic = 'force-dynamic'`);
  }
  if (!/'force-dynamic'|"force-dynamic"/.test(lines[dynamicLine] ?? '')) {
    throw new Error(`${label}: dynamic must be force-dynamic (RUNTIME DATABASE_URL)`);
  }
  if (dynamicLine < lastImportLine || importAfterDynamic) {
    throw new Error(
      `${label}: export const dynamic must come after all imports ` +
        `(found dynamic at line ${dynamicLine + 1}, last import at ${lastImportLine + 1})`,
    );
  }
}

function main() {
  const errors = [];

  // --- Route ownership: one explore page, under (map); no stale app/explore ---
  const explorePages = walkFiles(APP_DIR).filter((f) =>
    /(^|\/)explore\/page\.tsx$/.test(relativeAppPath(f)),
  );
  if (explorePages.length !== 1) {
    errors.push(
      `Expected exactly one explore/page.tsx under apps/web/src/app; found ${explorePages.length}: ` +
        explorePages.map(relativeAppPath).join(', '),
    );
  } else if (relativeAppPath(explorePages[0]) !== '(map)/explore/page.tsx') {
    errors.push(
      `Explore page must live at (map)/explore/page.tsx (ADR-017); found ${relativeAppPath(explorePages[0])}`,
    );
  }

  const staleExploreDir = path.join(APP_DIR, 'explore');
  try {
    if (statSync(staleExploreDir).isDirectory()) {
      errors.push(
        'Stale apps/web/src/app/explore/ directory present — conflicts with (map)/explore (delete it)',
      );
    }
  } catch {
    // absent is correct
  }

  const staleHome = path.join(APP_DIR, 'page.tsx');
  try {
    if (statSync(staleHome).isFile()) {
      errors.push(
        'Stale apps/web/src/app/page.tsx present — homepage must be (map)/page.tsx only (ADR-017)',
      );
    }
  } catch {
    // absent is correct
  }

  const mapHome = path.join(APP_DIR, '(map)', 'page.tsx');
  try {
    statSync(mapHome);
  } catch {
    errors.push('Missing apps/web/src/app/(map)/page.tsx (map-owned homepage)');
  }

  // --- force-dynamic module shape (RUNTIME DATABASE_URL / no seed bake) ---
  const dynamicGuarded = [
    path.join(APP_DIR, 'entity', '[id]', 'page.tsx'),
    path.join(APP_DIR, '(map)', 'layout.tsx'),
  ];
  for (const file of dynamicGuarded) {
    try {
      const source = readFileSync(file, 'utf8');
      assertDynamicAfterImports(source, relativeAppPath(file));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0) {
    console.error('check-web-entity-visibility-guards failed:\n');
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log(
    'check-web-entity-visibility-guards: ok (single (map)/explore, no stale routes, force-dynamic after imports)',
  );
}

main();
