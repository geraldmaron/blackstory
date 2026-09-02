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
import { ATLAS_INSTRUMENT_HREF } from '../nav/atlas-door';
import { parseExploreSearchParams } from './url-state';

function parseExploreHref(href: string) {
  const [, qs = ''] = href.split('?');
  return parseExploreSearchParams(Object.fromEntries(new URLSearchParams(qs)));
}

test('exploreHrefForState normalizes postal code and includes state (camera from state param)', () => {
  const href = exploreHrefForState(' tx ');
  assert.equal(href, '/explore?state=TX');

  const parsed = parseExploreHref(href);
  assert.equal(parsed.state, 'TX');
  assert.equal(parsed.viewport, undefined);
  assert.deepEqual(parsed.filters, {
    era: 'all',
    kind: 'all',
    tone: 'all',
    theme: 'all',
    status: 'all',
    confidence: 'all',
  });
  assert.equal(parsed.showFilters, false);
  assert.equal(parsed.showResults, false);
  assert.equal(parsed.showKey, false);
});

test('exploreHrefForState returns the Atlas instrument for empty or unknown postal codes', () => {
  assert.equal(exploreHrefForState(''), ATLAS_INSTRUMENT_HREF);
  assert.equal(exploreHrefForState('   '), ATLAS_INSTRUMENT_HREF);
  assert.equal(exploreHrefForState('ZZ'), ATLAS_INSTRUMENT_HREF);
});

test('exploreHrefForEra filters explore to one era bucket', () => {
  const href = exploreHrefForEra('1860s');
  assert.equal(href, '/explore?era=1860s');

  const parsed = parseExploreHref(href);
  assert.equal(parsed.filters.era, '1860s');
  assert.equal(parsed.filters.kind, 'all');
});

test('exploreHrefForEra returns /explore when era bucket is empty', () => {
  assert.equal(exploreHrefForEra(''), ATLAS_INSTRUMENT_HREF);
  assert.equal(exploreHrefForEra('   '), ATLAS_INSTRUMENT_HREF);
});

test('exploreHrefForKind filters explore to the entity kind family', () => {
  const href = exploreHrefForKind('place');
  assert.equal(href, '/explore?kind=places');

  const parsed = parseExploreHref(href);
  assert.equal(parsed.filters.kind, 'places');
  assert.equal(parsed.filters.era, 'all');
});

test('exploreHrefForKind returns /explore when kind is empty', () => {
  assert.equal(exploreHrefForKind(''), ATLAS_INSTRUMENT_HREF);
});

test('searchHrefForStatus emits /search links only for known non-all status tokens', () => {
  assert.equal(searchHrefForStatus('active'), '/records?status=active');
  assert.equal(searchHrefForStatus('in_force'), '/records?status=in_force');
  assert.equal(searchHrefForStatus('historic'), '/records?status=historic');
});

test('searchHrefForStatus returns undefined for all, empty, or unknown values', () => {
  assert.equal(searchHrefForStatus('all'), undefined);
  assert.equal(searchHrefForStatus(''), undefined);
  assert.equal(searchHrefForStatus('   '), undefined);
  assert.equal(searchHrefForStatus('published'), undefined);
  assert.equal(searchHrefForStatus('not-a-status'), undefined);
});

test('entityEvidenceHref appends or replaces the accepted-claims hash', () => {
  assert.equal(
    entityEvidenceHref('/entity/ent_dunbar_school_001'),
    '/entity/ent_dunbar_school_001#accepted-claims',
  );
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
    label: '1860s-1920s',
    href: '/explore?era=1860s',
  });
});
