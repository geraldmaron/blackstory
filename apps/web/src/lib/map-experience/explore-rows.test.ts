import assert from 'node:assert/strict';
import test from 'node:test';
import { drawableCollection } from '../discovery/explore-collection';
import { normalizePeriod } from '../discovery/collection-period';
import type { CollectionFacts } from '../records/records-matching';
import type { ExploreMapFeature } from './build-explore-map-source';
import { kindFamilyFor } from './kind-encoding';
import { rowDecadeLabel, sortExploreRows } from './explore-rows';

function feature(id: string, name: string, eraBuckets: readonly string[]): ExploreMapFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [-77, 39] },
    properties: {
      entityId: id,
      href: `/entity/${id}`,
      kind: 'place',
      displayName: name,
      oneLineStory: 'Test',
      precision: 'site',
      geoPrecisionTier: 'exact-site',
      eraBuckets,
      evidenceCount: 1,
      confidenceTier: 'high',
      topicTags: [],
      shade: '#C48A4A',
      glyph: 'circle',
      kindFamily: kindFamilyFor('place'),
    },
  };
}

const fact = (id: string, mappable: boolean) =>
  ({
    row: { id, name: id, kind: 'place', mapTone: 'neutral' },
    mappable,
  }) as unknown as CollectionFacts;

test('the column count plus the unmapped note equals the matched collection', () => {
  const features = [
    feature('a', 'Mother Bethel', ['1790s']),
    // An id-like stored name: Records lists it last, so the map must list it too.
    feature('b', 'W1BX42Q', ['1860s']),
    feature('c', 'Frogmore', []),
  ];
  const matches = [fact('a', true), fact('b', true), fact('c', true), fact('d', false)];
  const drawable = drawableCollection(features, matches);
  const header = sortExploreRows(drawable, 'discovery', null, undefined).length;
  const unmapped = matches.length - drawable.length;
  assert.equal(header + unmapped, matches.length);
  assert.equal(
    sortExploreRows(drawable, 'oldest', null, undefined).at(-1)?.properties.entityId,
    'b',
  );
});

test('under a decade range a row shows and sorts by its first decade inside the range', () => {
  const period = normalizePeriod({ start: '1860', end: '1940' });
  const church = feature('a', 'Mt. Pisgah', ['1780s', '1890s']);
  const school = feature('b', 'Dunbar', ['1870s']);
  assert.equal(rowDecadeLabel(church.properties.eraBuckets, period), '1890s');
  assert.equal(rowDecadeLabel(church.properties.eraBuckets, undefined), '1780s');
  assert.equal(rowDecadeLabel([], period), 'Undated');
  const ordered = sortExploreRows([church, school], 'oldest', null, period);
  assert.deepEqual(
    ordered.map((row) => row.properties.entityId),
    ['b', 'a'],
  );
});
