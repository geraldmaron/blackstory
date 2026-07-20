/**
 * Explore WHERE-field maps link resolver.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreMapSource } from './build-explore-map-source';
import { exploreWhereMapsLink } from './explore-where-maps-link';

describe('exploreWhereMapsLink', () => {
  it('builds a coordinate-first maps URL for a public feature', () => {
    const source = buildExploreMapSource(listPublicEntities());
    const feature = source.featureCollection.features.find(
      (entry) => entry.properties.entityId === 'ent_15th_st_church_001',
    );
    assert.ok(feature);

    const link = exploreWhereMapsLink(feature);
    assert.ok(link);
    assert.match(link.href, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    assert.equal(link.label, 'DC');
  });
});
