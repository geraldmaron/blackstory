/**
 * Tests for explore catalog record suggestions.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExploreMapFeature } from './build-explore-map-source';
import { suggestCatalogRecords } from './suggest-catalog-records';
import { kindFamilyFor } from './kind-encoding';

function feature(
  id: string,
  name: string,
  lng: number,
  lat: number,
  kind = 'place',
): ExploreMapFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      entityId: id,
      href: `/entity/${id}`,
      kind,
      displayName: name,
      oneLineStory: '',
      precision: 'site',
      geoPrecisionTier: 'exact-site',
      eraBuckets: [],
      notabilityLabels: [],
      evidenceCount: 0,
      confidenceTier: 'medium',
      topicTags: [],
      shade: '#B86B2A',
      glyph: 'place',
      kindFamily: kindFamilyFor(kind),
    },
  };
}

test('suggestCatalogRecords prefers exact then prefix matches', () => {
  const features = [
    feature('ent_harlem_001', 'Harlem', -73.94, 40.81),
    feature('ent_studio', 'Studio Museum in Harlem', -73.94, 40.8),
    feature('ent_other', 'Bronzeville', -87.62, 41.85),
  ];
  const hits = suggestCatalogRecords('harlem', features, 5);
  assert.equal(hits[0]?.entityId, 'ent_harlem_001');
  assert.ok(hits.some((h) => h.entityId === 'ent_studio'));
  assert.ok(!hits.some((h) => h.entityId === 'ent_other'));
});

test('suggestCatalogRecords ignores short queries', () => {
  assert.equal(suggestCatalogRecords('h', [feature('a', 'Harlem', 0, 0)]).length, 0);
});
