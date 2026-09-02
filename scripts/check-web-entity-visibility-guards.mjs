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

  // --- Route ownership: Door at `/`, Atlas at `/explore`, live JSON at `/explore/api` ---
  //
  // `/` is the Door (`DoorHome`, ISR). `/explore` is the Atlas instrument (`AtlasHome`,
  // force-dynamic — searchParams filters). Exactly one explore page; no stale `(map)` group.
  const explorePages = walkFiles(APP_DIR).filter((f) =>
    /(^|\/)explore\/page\.tsx$/.test(relativeAppPath(f)),
  );
  if (explorePages.length !== 1) {
    errors.push(
      `Expected exactly one explore/page.tsx (Atlas instrument); found ${explorePages.length}: ` +
        `${explorePages.map(relativeAppPath).join(', ') || '(none)'}`,
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

  // Read once and reuse the contents. Checking existence with statSync and then reading the same
  // path separately is a time-of-check/time-of-use pair (CodeQL js/file-system-race); a single
  // read that treats ENOENT as "missing" answers both questions without the window.
  const home = path.join(APP_DIR, 'page.tsx');
  let homeSource;
  try {
    homeSource = readFileSync(home, 'utf8');
  } catch {
    errors.push('Missing apps/web/src/app/page.tsx (the Atlas homepage)');
  }

  const exploreApiRoute = path.join(APP_DIR, 'explore', 'api', 'route.ts');
  try {
    statSync(exploreApiRoute);
  } catch {
    errors.push('Missing apps/web/src/app/explore/api/route.ts (live JSON refine endpoint)');
  }

  // --- No seed bake at build (RUNTIME DATABASE_URL) ---
  //
  // `/` is ISR (Door pin plate). `/explore` is force-dynamic (Atlas filters via searchParams).
  // `/entity/[id]` is ISR. force-dynamic on entity pages cost a CDN MISS on 100% of requests.
  // The no-seed-bake guarantee comes from generateStaticParams returning [] unconditionally.
  if (homeSource !== undefined) {
    const homeLabel = relativeAppPath(home);
    if (!/^export\s+const\s+revalidate\s*=\s*\d+/m.test(homeSource)) {
      errors.push(`${homeLabel}: missing export const revalidate (Door ISR)`);
    }
    if (/^export\s+const\s+dynamic\s*=/m.test(homeSource)) {
      errors.push(`${homeLabel}: must not declare force-dynamic — the Door is ISR`);
    }
    if (!/DoorHome/.test(homeSource)) {
      errors.push(`${homeLabel}: must mount DoorHome, not the Atlas instrument`);
    }
    if (/AtlasHome|HomeFirstPaint|wantsAtlasInstrument/.test(homeSource)) {
      errors.push(`${homeLabel}: must not mount the Atlas instrument`);
    }
  }

  if (explorePages.length === 1) {
    try {
      const exploreSource = readFileSync(explorePages[0], 'utf8');
      assertDynamicAfterImports(exploreSource, relativeAppPath(explorePages[0]));
      if (!/AtlasHome/.test(exploreSource)) {
        errors.push(`${relativeAppPath(explorePages[0])}: must mount AtlasHome`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const entityPage = path.join(APP_DIR, 'entity', '[id]', 'page.tsx');
  try {
    const source = readFileSync(entityPage, 'utf8');
    const label = relativeAppPath(entityPage);
    if (/^export\s+const\s+dynamic\s*=/m.test(source)) {
      errors.push(
        `${label}: must not declare export const dynamic — the route is ISR (revalidate), and ` +
          `force-dynamic here makes every entity request a CDN miss`,
      );
    }
    if (!/^export\s+const\s+revalidate\s*=\s*\d+/m.test(source)) {
      errors.push(`${label}: missing export const revalidate (ISR is what makes this cacheable)`);
    }
    if (!/^export\s+const\s+dynamicParams\s*=\s*true/m.test(source)) {
      errors.push(`${label}: missing export const dynamicParams = true`);
    }
    // The actual no-seed-bake guarantee. On Vercel DATABASE_URL IS present at build, so an
    // enumerating generateStaticParams would both bake pages and pull the whole catalog.
    const staticParams = /generateStaticParams\(\)[\s\S]*?\n}/.exec(source)?.[0] ?? '';
    if (staticParams === '') {
      errors.push(`${label}: missing generateStaticParams`);
    } else if (!/return \[\];/.test(staticParams) || /getPublicSearchIndex/.test(staticParams)) {
      errors.push(
        `${label}: generateStaticParams must return [] and must not read the catalog — ` +
          `enumerating ids prerenders ~4k pages and pulls the full catalog on every build`,
      );
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (errors.length > 0) {
    console.error('check-web-entity-visibility-guards failed:\n');
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log(
    'check-web-entity-visibility-guards: ok (Door at /, Atlas at /explore, /explore/api owned, segment config after imports)',
  );
}

main();
