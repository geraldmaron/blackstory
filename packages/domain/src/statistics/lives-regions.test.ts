import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIVES_REGIONS, livesRegionById, livesRegionBySlug } from './lives-regions.js';

test('region ids, slugs and parents are well formed and unique', () => {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const region of LIVES_REGIONS) {
    assert.match(region.id, /^region:[a-z0-9-]+$/);
    assert.match(region.slug, /^[a-z0-9-]+$/);
    assert.equal(region.parentId, `state:${region.stateFips}`);
    assert.ok(region.coreCountyFips.length > 0);
    for (const fips of region.coreCountyFips) {
      assert.match(fips, /^\d{5}$/);
      assert.ok(fips.startsWith(region.stateFips), `${fips} is outside state ${region.stateFips}`);
    }
    assert.equal(ids.has(region.id), false);
    assert.equal(slugs.has(region.slug), false);
    ids.add(region.id);
    slugs.add(region.slug);
  }
});

test('regions resolve by slug and by id', () => {
  assert.equal(livesRegionBySlug('chicago')?.id, 'region:chicago-il');
  assert.equal(livesRegionById('region:chicago-il')?.slug, 'chicago');
  assert.equal(livesRegionBySlug('atlantis'), undefined);
});
