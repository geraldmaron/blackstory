import assert from 'node:assert/strict';
import { test } from 'node:test';
import { livesAreaBySlug } from './lives-regions.js';
import {
  isLivesAreaSnapshot,
  livesSnapshotName,
  LIVES_SNAPSHOT_VERSION,
} from './lives-snapshot.js';
import { buildLivesAreaBundle } from './lives-timeline.js';

const bundle = buildLivesAreaBundle({
  area: livesAreaBySlug('deep-south')!,
  jurisdictions: [],
  observations: [],
  coverage: [],
  countNotes: [],
  applicability: [],
  frames: [],
});
const snapshot = {
  version: LIVES_SNAPSHOT_VERSION,
  areaSlug: 'deep-south',
  generatedAt: '2026-09-15T00:00:00.000Z',
  contentHash: 'abc',
  bundle,
  ruleEntities: {},
};

test('snapshot names are keyed by area slug', () => {
  assert.equal(livesSnapshotName('deep-south'), 'livesArea:deep-south');
});

test('a built bundle for the same area is a valid snapshot', () => {
  assert.equal(isLivesAreaSnapshot(JSON.parse(JSON.stringify(snapshot))), true);
});

test('other versions, another area, or missing decades are rejected', () => {
  assert.equal(isLivesAreaSnapshot({ ...snapshot, version: 2 }), false);
  assert.equal(isLivesAreaSnapshot({ ...snapshot, areaSlug: 'west' }), false);
  assert.equal(
    isLivesAreaSnapshot({ ...snapshot, bundle: { ...bundle, decades: bundle.decades.slice(1) } }),
    false,
  );
  assert.equal(isLivesAreaSnapshot(null), false);
});
