/**
 * Public-page stability contracts for client-side degraded states (e.g. explore map falling
 * back to its last-loaded snapshot on a transient API failure). This is distinct from — and does
 * not reintroduce — the removed server-side seed/snapshot fallback for public entity/story reads;
 * Postgres read failures on the server now propagate as errors.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');

/** Non-alarming degraded copy required on the explore map during a client-side API hiccup. */
export const PUBLIC_DEGRADED_COPY_CONTRACT = Object.freeze({
  exploreMapFallback: 'showing the accessible list view',
  exploreRefineFallback: 'showing the last-loaded snapshot',
} as const);

test('explore snapshot-mode copy never ships bare errors', () => {
  const path = join(repoRoot, 'apps/web/src/lib/map-experience/snapshot-mode.ts');
  const source = readFileSync(path, 'utf8');
  assert.match(source, new RegExp(PUBLIC_DEGRADED_COPY_CONTRACT.exploreMapFallback, 'i'));
  assert.match(source, new RegExp(PUBLIC_DEGRADED_COPY_CONTRACT.exploreRefineFallback, 'i'));
  assert.match(source, /never a bare error message/i);
});
