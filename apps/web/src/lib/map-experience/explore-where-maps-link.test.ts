/**
 * Explore WHERE-field maps link resolver.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreMapSource } from './build-explore-map-source';
import { exploreWhereMapsLink } from './explore-where-maps-link';
import type { ExploreMapFeature } from './build-explore-map-source';

describe('exploreWhereMapsLink', () => {
  it('prefers locationLabel over state postal code for the Where chip', () => {
    const source = buildExploreMapSource(listPublicEntities());
    const feature = source.featureCollection.features.find(
      (entry) => entry.properties.entityId === 'ent_15th_st_church_001',
    );
    assert.ok(feature);

    const link = exploreWhereMapsLink(feature);
    assert.ok(link);
    assert.match(link.href, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    assert.equal(
      link.label,
      'Dupont/Sixteenth Street Historic District area (neighborhood-level pin)',
    );
    assert.equal(link.placeLabel, link.label);
  });

  it('falls back to state postal code when locationLabel is absent', () => {
    const feature: ExploreMapFeature = {
      type: 'Feature',
      id: 'ent_test',
      geometry: { type: 'Point', coordinates: [-73.9465, 40.8116] },
      properties: {
        entityId: 'ent_test',
        href: '/entity/ent_test',
        kind: 'movement',
        displayName: 'Test',
        oneLineStory: 'Test',
        precision: 'city',
        geoPrecisionTier: 'city',
        eraBuckets: [],
        notabilityLabels: [],
        evidenceCount: 0,
        confidenceTier: 'high',
        topicTags: [],
        shade: 'copper',
        glyph: 'circle',
        statePostalCode: 'NY',
        stateName: 'New York',
      },
    };
    const link = exploreWhereMapsLink(feature);
    assert.ok(link);
    assert.equal(link.label, 'New York');
  });
});
