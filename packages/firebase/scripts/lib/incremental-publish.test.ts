/**
 * Unit tests for incremental publish gating and row mapping.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReleaseSourceFromLandscape,
  gateLandscapePublishCandidate,
  incrementalPublishProvenancePatch,
  jurisdictionFromProvenance,
  toReleaseEntityRow,
  type LandscapePublishRow,
} from './incremental-publish.ts';
import { buildReleaseEntityArtifacts } from '@repo/domain';

const baseRow = (overrides: Partial<LandscapePublishRow> = {}): LandscapePublishRow => ({
  id: 'dc-black-history-sites-b10',
  lane: 'dc-sites',
  kind: 'place',
  display_name: 'Gardner Bishop Barber Shop',
  summary:
    'Business site at 1900 15th Street NW in Washington, DC (1940), documented in the DC Historic Preservation Office inventory.',
  lat: 38.915775,
  lng: -77.034763,
  canonical_url: 'https://historicsites.dcpreservation.org/items/show/1055',
  source_item_id: 'b10',
  provenance: {
    sourceCategory: 'Business',
    historicAddress: '1900 15th Street NW',
    sourceCity: 'Washington',
    sourceState: 'DC',
  },
  payload: {},
  exact_in_release: false,
  name_overlap: false,
  ...overrides,
});

test('jurisdictionFromProvenance maps DC to full label', () => {
  assert.equal(
    jurisdictionFromProvenance({ sourceCity: 'Washington', sourceState: 'DC' }),
    'Washington, District of Columbia',
  );
});

test('buildReleaseSourceFromLandscape produces claims from canonical_url', () => {
  const entry = buildReleaseSourceFromLandscape(baseRow());
  assert.ok(entry);
  assert.equal(entry?.claims?.length, 1);
  assert.equal(entry?.claims?.[0]?.citationHref, 'https://historicsites.dcpreservation.org/items/show/1055');
});

test('gateLandscapePublishCandidate rejects person privacy holds', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow({ kind: 'person' }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'person_kind');
});

test('gateLandscapePublishCandidate rejects greenbook lane', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow({ lane: 'greenbook' }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'greenbook_lane');
});

test('gateLandscapePublishCandidate rejects already-in-public rows', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow({ exact_in_release: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'already_in_public');
});

test('gateLandscapePublishCandidate accepts tier-1 DC site stub', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, true);
  if (result.eligible) {
    assert.ok(result.confidence >= 0.75);
    const build = buildReleaseEntityArtifacts(result.entry, {
      releaseId: 'rel_seed_001',
      generatedAt: '2026-07-22T00:00:00.000Z',
    });
    assert.equal(build.ok, true);
    if (build.ok) {
      const row = toReleaseEntityRow(build.projection);
      assert.equal(row.entity_id, 'dc-black-history-sites-b10');
      assert.equal(row.release_id, 'rel_seed_001');
    }
  }
});

test('incrementalPublishProvenancePatch records publish metadata', () => {
  const patch = incrementalPublishProvenancePatch('dc-black-history-sites-b10');
  assert.equal(patch.publishedReleaseEntityId, 'dc-black-history-sites-b10');
  assert.ok(typeof patch.incremental_publish === 'string');
});
