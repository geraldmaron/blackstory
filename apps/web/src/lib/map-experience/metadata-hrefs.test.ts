/**
 * Unit tests for shareable metadata href builders (state, era, kind, status, evidence).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  entityEvidenceHref,
  eraFactLink,
  exploreHrefForEra,
  exploreHrefForKind,
  exploreHrefForState,
  searchHrefForStatus,
} from './metadata-hrefs';
import { parseExploreSearchParams } from './url-state';

function parseExploreHref(href: string) {
  const [, qs = ''] = href.split('?');
  return parseExploreSearchParams(Object.fromEntries(new URLSearchParams(qs)));
}

test('exploreHrefForState normalizes postal code and includes state + viewport for Texas', () => {
  const href = exploreHrefForState(' tx ');
  assert.match(href, /^\/explore\?/);

  const parsed = parseExploreHref(href);
  assert.equal(parsed.state, 'TX');
  assert.ok(parsed.viewport);
  assert.equal(typeof parsed.viewport!.lat, 'number');
  assert.equal(typeof parsed.viewport!.lng, 'number');
  assert.equal(parsed.viewport!.zoom, 6.2);
  assert.deepEqual(parsed.filters, { era: 'all', kind: 'all', theme: 'all', confidence: 'all' });
  assert.equal(parsed.showFilters, true);
  assert.equal(parsed.showResults, true);
});

test('exploreHrefForState returns bare /explore for empty or unknown postal codes', () => {
  assert.equal(exploreHrefForState(''), '/explore');
  assert.equal(exploreHrefForState('   '), '/explore');
  assert.equal(exploreHrefForState('ZZ'), '/explore');
});

test('exploreHrefForEra filters explore to one era bucket', () => {
  const href = exploreHrefForEra('1860s');
  assert.equal(href, '/explore?era=1860s');

  const parsed = parseExploreHref(href);
  assert.equal(parsed.filters.era, '1860s');
  assert.equal(parsed.filters.kind, 'all');
});

test('exploreHrefForEra returns /explore when era bucket is empty', () => {
  assert.equal(exploreHrefForEra(''), '/explore');
  assert.equal(exploreHrefForEra('   '), '/explore');
});

test('exploreHrefForKind filters explore to one entity kind', () => {
  const href = exploreHrefForKind('place');
  assert.equal(href, '/explore?kind=place');

  const parsed = parseExploreHref(href);
  assert.equal(parsed.filters.kind, 'place');
  assert.equal(parsed.filters.era, 'all');
});

test('exploreHrefForKind returns /explore when kind is empty', () => {
  assert.equal(exploreHrefForKind(''), '/explore');
});

test('searchHrefForStatus emits /search links only for known non-all status tokens', () => {
  assert.equal(searchHrefForStatus('active'), '/search?status=active');
  assert.equal(searchHrefForStatus('in_force'), '/search?status=in_force');
  assert.equal(searchHrefForStatus('historic'), '/search?status=historic');
});

test('searchHrefForStatus returns undefined for all, empty, or unknown values', () => {
  assert.equal(searchHrefForStatus('all'), undefined);
  assert.equal(searchHrefForStatus(''), undefined);
  assert.equal(searchHrefForStatus('   '), undefined);
  assert.equal(searchHrefForStatus('published'), undefined);
  assert.equal(searchHrefForStatus('not-a-status'), undefined);
});

test('entityEvidenceHref appends or replaces the accepted-claims hash', () => {
  assert.equal(entityEvidenceHref('/entity/ent_dunbar_school_001'), '/entity/ent_dunbar_school_001#accepted-claims');
  assert.equal(
    entityEvidenceHref('/entity/ent_dunbar_school_001?ref=map'),
    '/entity/ent_dunbar_school_001?ref=map#accepted-claims',
  );
  assert.equal(
    entityEvidenceHref('/entity/ent_dunbar_school_001#old-section'),
    '/entity/ent_dunbar_school_001#accepted-claims',
  );
});

test('eraFactLink handles undated, single-bucket, and multi-bucket labels', () => {
  assert.deepEqual(eraFactLink([]), { label: 'Undated' });
  assert.deepEqual(eraFactLink(['', '  ']), { label: 'Undated' });

  assert.deepEqual(eraFactLink(['1860s']), {
    label: '1860s',
    href: '/explore?era=1860s',
  });

  assert.deepEqual(eraFactLink(['1860s', '1890s', '1920s']), {
    label: '1860s – 1920s',
    href: '/explore?era=1860s',
  });
});
