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
import { isPublicReadApiDisabled, readEntityFromReleaseSnapshot } from './degraded-mode';
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

test('degraded mode reads bundled release snapshots', () => {
  const prior = process.env.PUBLIC_READ_API_DISABLED;
  process.env.PUBLIC_READ_API_DISABLED = '1';
  assert.equal(isPublicReadApiDisabled(), true);
  assert.equal(
    readEntityFromReleaseSnapshot('ent_15th_st_church_001')?.displayName,
    'Fifteenth Street Presbyterian Church',
  );
  process.env.PUBLIC_READ_API_DISABLED = prior;
});

test('entity detail route stays force-dynamic so RUNTIME DATABASE_URL is used', () => {
  // Regression: build-time GSP without DATABASE_URL baked seed-snapshot into
  // /entity/ent_15th_st_church_001 while non-seed ids still read rel_seed_001.
  const source = readFileSync(join(APP_ROOT, 'entity/[id]/page.tsx'), 'utf8');
  assert.match(source, /export const dynamic = 'force-dynamic'/);
});

/**
 * Next.js App Router: route segment config must come AFTER imports. Placing
 * `export const dynamic` between import statements previously broke entity RSC.
 */
function assertForceDynamicAfterImports(source: string, label: string): void {
  const lines = source.split(/\r?\n/);
  let lastImportLine = -1;
  let dynamicLine = -1;
  let importAfterDynamic = false;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = (lines[i] ?? '').trimStart();
    const isImport =
      /^import\s/.test(trimmed) || /^import["']/.test(trimmed) || /^import\{/.test(trimmed);
    const isDynamic = /^export\s+const\s+dynamic\s*=/.test(trimmed);
    if (isImport) {
      lastImportLine = i;
      if (dynamicLine >= 0) importAfterDynamic = true;
    }
    if (isDynamic) {
      assert.equal(dynamicLine, -1, `${label}: duplicate export const dynamic`);
      dynamicLine = i;
    }
  }
  assert.notEqual(dynamicLine, -1, `${label}: missing export const dynamic`);
  assert.match(lines[dynamicLine] ?? '', /force-dynamic/);
  assert.equal(
    dynamicLine > lastImportLine && !importAfterDynamic,
    true,
    `${label}: export const dynamic must come after all imports (dynamic@${dynamicLine + 1}, lastImport@${lastImportLine + 1})`,
  );
}

test('map layout and entity page keep force-dynamic after all imports', () => {
  assertForceDynamicAfterImports(
    readFileSync(join(APP_ROOT, 'entity/[id]/page.tsx'), 'utf8'),
    'entity/[id]/page.tsx',
  );
  assertForceDynamicAfterImports(
    readFileSync(join(APP_ROOT, '(map)/layout.tsx'), 'utf8'),
    '(map)/layout.tsx',
  );
});

test('explore and homepage live only under (map) — no duplicate route segments', () => {
  // Regression: apps/web/src/app/explore + (map)/explore both claimed /explore;
  // stale app/page.tsx fought (map)/page.tsx for /. ADR-017: map group owns both.
  const explorePages = collectAppRouteFiles(APP_ROOT).filter((file) =>
    /(^|\/)explore\/page\.tsx$/.test(file.slice(APP_ROOT.length + 1).split('\\').join('/')),
  );
  assert.equal(explorePages.length, 1, `explore pages: ${explorePages.join(', ')}`);
  assert.match(explorePages[0]!.replace(/\\/g, '/'), /\/\(map\)\/explore\/page\.tsx$/);

  assert.equal(
    existsSync(join(APP_ROOT, 'explore')),
    false,
    'stale apps/web/src/app/explore/ must not exist',
  );
  assert.equal(
    existsSync(join(APP_ROOT, 'page.tsx')),
    false,
    'stale apps/web/src/app/page.tsx must not exist (homepage is (map)/page.tsx)',
  );
  assert.equal(existsSync(join(APP_ROOT, '(map)/page.tsx')), true);
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
