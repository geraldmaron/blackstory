/**
 * The place loader resolves one published record per slug, never the catalog, and never stands
 * somewhere else when the slug misses.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreMapSource } from '../../lib/map-experience/build-explore-map-source';
import { loadPlaceRecord } from './place-record';

test('every /place/ href on the seed map source resolves to its record', async () => {
  const source = buildExploreMapSource(listPublicEntities());
  const placeHrefs = source.featureCollection.features
    .map((feature) => feature.properties.href)
    .filter((href) => href.startsWith('/place/'));
  assert.ok(placeHrefs.length > 0);
  for (const href of placeHrefs) {
    assert.ok(await loadPlaceRecord(href.slice('/place/'.length)), `${href} must hold`);
  }
});

test('a named slug resolves to that place, and a miss resolves to nothing', async () => {
  const church = await loadPlaceRecord('fifteenth-street-presbyterian-church');
  assert.equal(church?.displayName, 'Fifteenth Street Presbyterian Church');
  assert.equal(await loadPlaceRecord('no-such-place'), undefined);
  assert.equal(await loadPlaceRecord('ent_dunbar_school_001'), undefined);
});

test('the loader reads one record, never the full catalog', () => {
  const source = readFileSync(new URL('./place-record.ts', import.meta.url), 'utf8');
  assert.match(source, /resolvePublicEntityView/);
  assert.match(source, /getPublicSearchIndex/);
  assert.doesNotMatch(source, /getSharedPublicEntities|listPublicEntityViews\(/);
  assert.doesNotMatch(source, /\/atlas\/catalog/);
});
