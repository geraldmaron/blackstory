/**
 * Tests for the jurisdiction resolver's in-memory implementation (no Firestore
 * dependency). The Firestore-backed `createFirestoreJurisdictionResolver` shares the exact
 * same `{exists, get}` shape, exercised here structurally via the in-memory variant, and used
 * for real in `load-cli.ts`'s CLI entry (not unit-testable without a live Firestore instance).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInMemoryJurisdictionDocResolver } from './resolver.js';
import type { JurisdictionDoc } from './schema.js';

const CALIFORNIA: JurisdictionDoc = {
  id: 'us-06',
  kind: 'state',
  name: 'California',
  parentId: 'us',
  fipsCode: '06',
  postalCode: 'CA',
  bbox: [-124.5, 32.5, -114.1, 42.0],
  bboxSource: 'us-geography-module',
  sourceDataset: 'us-geography-module',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('resolver.exists is true for a known jurisdiction and false for a dangling id', async () => {
  const resolver = createInMemoryJurisdictionDocResolver([CALIFORNIA]);
  assert.equal(await resolver.exists('us-06'), true);
  assert.equal(await resolver.exists('us-99'), false);
});

test('resolver.get returns the full doc for a known id and undefined for a dangling one', async () => {
  const resolver = createInMemoryJurisdictionDocResolver([CALIFORNIA]);
  const found = await resolver.get('us-06');
  assert.deepEqual(found, CALIFORNIA);
  assert.equal(await resolver.get('us-99'), undefined);
});

test('resolver shape is compatible with the domain JurisdictionResolver duck-type ({exists})', async () => {
  const resolver = createInMemoryJurisdictionDocResolver([CALIFORNIA]);
  // Structural check: a caller expecting only `{exists(id): Promise<boolean>}` (the domain
  // `JurisdictionResolver` interface) can use this resolver unmodified.
  const asJurisdictionResolver: { exists(id: string): Promise<boolean> } = resolver;
  assert.equal(await asJurisdictionResolver.exists('us-06'), true);
});
