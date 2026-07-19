/**
 * Public render path and response limit tests.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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
  const forbiddenModuleSpecifier = ['@blap', 'data-access/firestore'].join('/');
  const findings = collectPublicRenderPathFindings(
    'fake.tsx',
    `// re-exported from '${forbiddenModuleSpecifier}' upstream`,
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
