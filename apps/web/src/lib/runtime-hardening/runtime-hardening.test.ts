/**
 * Public render path and response limit tests.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { APP_HOSTING_RUN_LIMITS, RESPONSE_SIZE_LIMITS } from './constants';
import { assertPublicRenderPathSafe, collectPublicRenderPathFindings } from './public-render-path';
import {
  assertResponseWithinLimit,
  isWithinResponseLimit,
  utf8ByteLength,
} from './response-size-limits';
import { isProductionPublicRuntime, sanitizeClientErrorDisplay } from './error-surface';

const APP_ROOT = new URL('../../app', import.meta.url).pathname;

function collectAppRouteFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectAppRouteFiles(fullPath));
      continue;
    }
    if (/\.(tsx?)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

test('production run limits are tighter than prior defaults', () => {
  assert.ok(APP_HOSTING_RUN_LIMITS.production.maxInstances <= 6);
  assert.ok(APP_HOSTING_RUN_LIMITS.production.concurrency <= 40);
  assert.ok(APP_HOSTING_RUN_LIMITS.staging.maxInstances <= 2);
  assert.ok(APP_HOSTING_RUN_LIMITS.staging.concurrency <= 20);
});

test('response size guard rejects oversized html payloads', () => {
  const limit = RESPONSE_SIZE_LIMITS.html;
  assert.throws(() => assertResponseWithinLimit(limit + 1, 'html'), /exceeds limit/);
  assert.equal(isWithinResponseLimit(limit, 'html'), true);
  assert.equal(utf8ByteLength('hello'), 5);
});

test('public app routes do not import database or model clients', () => {
  for (const file of collectAppRouteFiles(APP_ROOT)) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotThrow(() => assertPublicRenderPathSafe(file, source));
  }
});

test('collectPublicRenderPathFindings flags forbidden imports', () => {
  // A bare "from '...'" (no leading import/export keyword) satisfies
  // FORBIDDEN_PUBLIC_RENDER_IMPORTS' import-context requirement without
  // satisfying scripts/validate-boundaries.mjs's IMPORT_PATTERN (which
  // requires a literal "import"/"export" keyword) so this fixture
  // exercises the real detector without the repo-wide boundary scanner
  // mistaking it for an actual cross-boundary import.
  const findings = collectPublicRenderPathFindings(
    'fake.tsx',
    `// re-exported from '@repo/data-access' upstream`,
  );
  assert.equal(findings.length, 1);
});

test('entity detail route never prerenders, so RUNTIME DATABASE_URL is used', () => {
  // Regression this guards: build-time GSP without DATABASE_URL baked seed-snapshot into
  // /entity/ent_15th_st_church_001 while non-seed ids still read rel_seed_001.
  //
  // force-dynamic used to be how that was prevented. It also forced Next to send
  // `private, no-cache, no-store` on every response, overriding the s-maxage=3600 this route
  // declares in next.config.mjs, so x-vercel-cache was MISS on 100% of entity requests.
  //
  // The route is now ISR, and the same guarantee is enforced at its source: generateStaticParams
  // returns [] unconditionally, so there is no id for the build to bake. That is strictly
  // stronger than force-dynamic here — force-dynamic left the enumeration in place and merely
  // caused Next to ignore it.
  const source = readFileSync(join(APP_ROOT, 'entity/[id]/page.tsx'), 'utf8');
  assert.match(source, /export const revalidate = \d+/);
  assert.match(source, /export const dynamicParams = true/);

  const staticParams = /generateStaticParams\(\)[\s\S]*?\n}/.exec(source)?.[0] ?? '';
  assert.notEqual(staticParams, '', 'entity page must declare generateStaticParams');
  assert.match(staticParams, /return \[\];/);
  // The specific failure mode: reading the catalog at build and prerendering every id.
  assert.doesNotMatch(staticParams, /getPublicSearchIndex|listPublicEntityViews/);
});

/**
 * Next.js App Router: route segment config must come AFTER imports. Placing
 * `export const dynamic` between import statements previously broke entity RSC.
 */
function assertSegmentConfigAfterImports(
  source: string,
  label: string,
  configName: 'dynamic' | 'revalidate',
  valuePattern: RegExp,
): void {
  const lines = source.split(/\r?\n/);
  const declaration = new RegExp(`^export\\s+const\\s+${configName}\\s*=`);
  let lastImportLine = -1;
  let configLine = -1;
  let importAfterConfig = false;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = (lines[i] ?? '').trimStart();
    const isImport =
      /^import\s/.test(trimmed) || /^import["']/.test(trimmed) || /^import\{/.test(trimmed);
    const isConfig = declaration.test(trimmed);
    if (isImport) {
      lastImportLine = i;
      if (configLine >= 0) importAfterConfig = true;
    }
    if (isConfig) {
      assert.equal(configLine, -1, `${label}: duplicate export const ${configName}`);
      configLine = i;
    }
  }
  assert.notEqual(configLine, -1, `${label}: missing export const ${configName}`);
  assert.match(lines[configLine] ?? '', valuePattern);
  assert.equal(
    configLine > lastImportLine && !importAfterConfig,
    true,
    `${label}: export const ${configName} must come after all imports (${configName}@${configLine + 1}, lastImport@${lastImportLine + 1})`,
  );
}

test('Atlas and entity route segment config stays after all imports', () => {
  // The ordering rule is about Next parsing route segment config, not about which config it is:
  // placing the export between import statements previously broke entity RSC. It applies to the
  // entity route's `revalidate` exactly as it did to its former `dynamic`.
  assertSegmentConfigAfterImports(
    readFileSync(join(APP_ROOT, 'entity/[id]/page.tsx'), 'utf8'),
    'entity/[id]/page.tsx',
    'revalidate',
    /\d+/,
  );
  assertSegmentConfigAfterImports(
    readFileSync(join(APP_ROOT, 'page.tsx'), 'utf8'),
    'page.tsx',
    'dynamic',
    /force-dynamic/,
  );
});

test('the Atlas is one route — `/` — with no page rendering at /explore', () => {
  // `/` IS the Atlas and `/explore` 308s to it, so a second page file claiming /explore would
  // shadow that redirect and quietly resurrect the surface the redirect exists to retire.
  const explorePages = collectAppRouteFiles(APP_ROOT).filter((file) =>
    /(^|\/)explore\/page\.tsx$/.test(
      file
        .slice(APP_ROOT.length + 1)
        .split('\\')
        .join('/'),
    ),
  );
  assert.deepEqual(explorePages, [], `no page may render at /explore: ${explorePages.join(', ')}`);

  assert.equal(
    existsSync(join(APP_ROOT, '(map)')),
    false,
    'stale apps/web/src/app/(map)/ route group must not exist',
  );
  assert.equal(existsSync(join(APP_ROOT, 'page.tsx')), true);
  // /explore/api keeps its URL — the redirect is the exact path only.
  assert.equal(existsSync(join(APP_ROOT, 'explore/api/route.ts')), true);
});

test('production error surface hides stacks and long messages', () => {
  const prior = process.env.NEXT_PUBLIC_APP_ENV;
  process.env.NEXT_PUBLIC_APP_ENV = 'production';
  assert.equal(isProductionPublicRuntime(), true);
  const display = sanitizeClientErrorDisplay(
    Object.assign(new Error('secret connection string at db.internal'), { digest: 'abc123' }),
  );
  assert.equal(display.detail, 'Reference abc123');
  assert.equal(display.logDetail, undefined);
  process.env.NEXT_PUBLIC_APP_ENV = prior;
});
