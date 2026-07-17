
/**
 * degraded-mode and public-page stability contracts.
 * Canonical copy strings must stay aligned with apps/web snapshot-mode and DegradedModeNotice.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');

/** Non-alarming degraded copy required on every public surface during API outage. */
export const PUBLIC_DEGRADED_COPY_CONTRACT = Object.freeze({
  snapshotShellTitle: 'Showing snapshot data',
  snapshotShellBodyFragments: ['last published', 'release snapshot'] as const,
  exploreMapFallback: 'showing the accessible list view',
  exploreRefineFallback: 'showing the last-loaded snapshot',
} as const);

test('DegradedModeNotice exposes role=status snapshot banner copy', () => {
  const path = join(repoRoot, 'apps/web/src/components/DegradedModeNotice.tsx');
  const source = readFileSync(path, 'utf8');
  assert.match(source, new RegExp(PUBLIC_DEGRADED_COPY_CONTRACT.snapshotShellTitle));
  assert.match(source, /role="status"/);
  for (const fragment of PUBLIC_DEGRADED_COPY_CONTRACT.snapshotShellBodyFragments) {
    assert.match(source, new RegExp(fragment));
  }
});

test('explore snapshot-mode copy never ships bare errors', () => {
  const path = join(repoRoot, 'apps/web/src/lib/map-experience/snapshot-mode.ts');
  const source = readFileSync(path, 'utf8');
  assert.match(source, new RegExp(PUBLIC_DEGRADED_COPY_CONTRACT.exploreMapFallback, 'i'));
  assert.match(source, new RegExp(PUBLIC_DEGRADED_COPY_CONTRACT.exploreRefineFallback, 'i'));
  assert.match(source, /never a bare error message/i);
});

test('core journey degraded fixture includes stable main landmark', () => {
  const fixturePath = join(repoRoot, 'packages/testing/src/a11y/journey-fixtures.ts');
  const source = readFileSync(fixturePath, 'utf8');
  assert.match(source, /degraded-shell/);
  assert.match(source, new RegExp(PUBLIC_DEGRADED_COPY_CONTRACT.snapshotShellTitle));
  assert.match(source, /<main id="main">/);
});
