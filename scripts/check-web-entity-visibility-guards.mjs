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
 * `export const dynamic = …` must appear after every top-level import: placed between
 * imports, it breaks the entity RSC module.
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
      /^import\s/.test(trimmed) || /^import["']/.test(trimmed) || /^import\{/.test(trimmed);
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

  // --- Route ownership: no explore page, and it owns /explore/api ---
  //
  // `/` is the Atlas, at `app/page.tsx`, carrying its own `force-dynamic` (RUNTIME
  // DATABASE_URL — no group layout owns it). `/explore` is a plain redirect route with no page
  // of its own; `/explore/api` is the live JSON refine endpoint at `app/explore/api/route.ts`.
  // Route ownership stays exclusive: the Atlas must not sprout a second explore page, a stale
  // duplicate homepage, or a competing `app/explore/page.tsx`.
  const explorePages = walkFiles(APP_DIR).filter((f) =>
    /(^|\/)explore\/page\.tsx$/.test(relativeAppPath(f)),
  );
  if (explorePages.length > 0) {
    errors.push(
      `Expected no explore/page.tsx under apps/web/src/app (/explore only redirects to / — the ` +
        `Atlas page lives at app/page.tsx); found: ${explorePages.map(relativeAppPath).join(', ')}`,
    );
  }

  const staleMapGroup = path.join(APP_DIR, '(map)');
  try {
    if (statSync(staleMapGroup).isDirectory()) {
      errors.push(
        'Stale apps/web/src/app/(map)/ route group present — the Atlas and /explore/api live ' +
          'directly under apps/web/src/app (delete the group)',
      );
    }
  } catch {
    // absent is correct
  }

  const home = path.join(APP_DIR, 'page.tsx');
  try {
    statSync(home);
  } catch {
    errors.push('Missing apps/web/src/app/page.tsx (the Atlas homepage)');
  }

  const exploreApiRoute = path.join(APP_DIR, 'explore', 'api', 'route.ts');
  try {
    statSync(exploreApiRoute);
  } catch {
    errors.push('Missing apps/web/src/app/explore/api/route.ts (live JSON refine endpoint)');
  }

  // --- force-dynamic module shape (RUNTIME DATABASE_URL / no seed bake) ---
  const dynamicGuarded = [
    path.join(APP_DIR, 'entity', '[id]', 'page.tsx'),
    path.join(APP_DIR, 'page.tsx'),
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
    'check-web-entity-visibility-guards: ok (no stray explore page, / and /explore/api owned, force-dynamic after imports)',
  );
}

main();
