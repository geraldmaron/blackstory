/**
 * Tests for law browse/detail view-model shaping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLawBrowseViewModel, buildLawDetailViewModel, lawBrowseHref } from './law-view-model';
import { seedLegalCatalog } from '../../lib/legal/public-source';

// Seed-backed source keeps these deterministic and off postgres; the Supabase path
// is exercised by loadLegalCatalog itself.
const source = seedLegalCatalog();

test('buildLawBrowseViewModel returns all seed entries by default', () => {
  const view = buildLawBrowseViewModel({}, source);
  assert.ok(view.totalMatched >= 5);
  assert.equal(view.kind, 'all');
});

test('buildLawBrowseViewModel filters by topic', () => {
  const view = buildLawBrowseViewModel({ topic: 'voting' }, source);
  assert.ok(view.totalMatched >= 1);
  for (const item of view.items) {
    assert.ok(item.topics.includes('voting'));
  }
});

test('browse defaults to oldest-first, not alphabetical by title', () => {
  const view = buildLawBrowseViewModel({}, source);
  assert.equal(view.sort, 'chronological');
  const years = view.items.map((item) => item.effectiveYear).filter((y): y is number => !!y);
  assert.ok(years.length >= 12, 'every seed row should carry an effectiveYear');
  assert.deepEqual(
    years,
    [...years].sort((a, b) => a - b),
  );
  // The old ordering put "42 U.S.C. § 1983" first purely because of the leading digit.
  assert.equal(view.items[0]?.slug, 'thirteenth-amendment');
});

test('browse supports newest-first and A-to-Z ordering', () => {
  const recent = buildLawBrowseViewModel({ sort: 'recent' }, source);
  const recentYears = recent.items.map((i) => i.effectiveYear).filter((y): y is number => !!y);
  assert.deepEqual(
    recentYears,
    [...recentYears].sort((a, b) => b - a),
  );

  const alpha = buildLawBrowseViewModel({ sort: 'title' }, source);
  const titles = alpha.items.map((i) => i.title);
  assert.deepEqual(
    titles,
    [...titles].sort((a, b) => a.localeCompare(b)),
  );
});

test('an unknown sort value falls back to the default instead of throwing', () => {
  const view = buildLawBrowseViewModel({ sort: 'nonsense' }, source);
  assert.equal(view.sort, 'chronological');
  assert.equal(view.totalMatched, buildLawBrowseViewModel({}, source).totalMatched);
});

test('browse items carry a plain-language summary trimmed to one sentence', () => {
  const view = buildLawBrowseViewModel({}, source);
  const brown = view.items.find((item) => item.slug === 'brown-v-board-of-education');
  assert.ok(brown?.summary);
  // "347 U.S. 483 (1954)" must not be mistaken for a sentence break, and the row already prints
  // the name, so the line starts after it.
  assert.match(brown.summary, /^347 U\.S\. 483 \(1954\),/);
  assert.ok(brown.summary.endsWith('.'));
  const thirteenth = view.items.find((item) => item.slug === 'thirteenth-amendment');
  assert.match(thirteenth?.summary ?? '', /^Ratified December 6, 1865,/);
});

test('a facet value no entry carries is dropped, not echoed back as a filter', () => {
  const view = buildLawBrowseViewModel({ kind: 'state-law', topic: 'zzz', status: ' ' }, source);
  assert.equal(view.kind, 'all');
  assert.equal(view.topic, 'all');
  assert.equal(view.status, 'all');
  assert.equal(view.isFiltered, false);
  assert.equal(view.totalMatched, view.totalAvailable);
});

test('isFiltered drives the "N of M" dek only when a facet narrows the catalog', () => {
  const all = buildLawBrowseViewModel({}, source);
  assert.equal(all.isFiltered, false);
  assert.equal(all.totalMatched, all.totalAvailable);

  const filtered = buildLawBrowseViewModel({ topic: 'voting' }, source);
  assert.equal(filtered.isFiltered, true);
  assert.ok(filtered.totalMatched < filtered.totalAvailable);
});

test('buildLawDetailViewModel resolves explainer for CRA 1964', () => {
  const view = buildLawDetailViewModel('civil-rights-act-1964', source);
  assert.equal(view.kind, 'ok');
  if (view.kind !== 'ok') return;
  assert.equal(view.snapshot.slug, 'civil-rights-act-1964');
  assert.ok(view.explainer);
});

test('buildLawDetailViewModel returns not_found for unknown slug', () => {
  const view = buildLawDetailViewModel('does-not-exist', source);
  assert.equal(view.kind, 'not_found');
});

test('the whole catalog renders at once, grouped by era in the current order', () => {
  const snapshots = [1868, 1964, 1865, 2013].map((year, i) => ({
    ...source.snapshots[0]!,
    id: `fixture-${i}`,
    slug: `fixture-${i}`,
    title: `Fixture ${year}`,
    effectiveYear: year,
  }));
  const catalog = { snapshots, explainerFor: () => undefined };
  const oldest = buildLawBrowseViewModel({}, catalog);
  assert.equal(oldest.items.length, 4);
  assert.deepEqual(
    oldest.groups.map((group) => [group.era.id, group.items.map((item) => item.effectiveYear)]),
    [
      ['reconstruction', [1865, 1868]],
      ['civil-rights', [1964]],
      ['since-1969', [2013]],
    ],
  );
  const newest = buildLawBrowseViewModel({ sort: 'recent' }, catalog);
  assert.deepEqual(
    newest.groups.map((group) => group.era.id),
    ['since-1969', 'civil-rights', 'reconstruction'],
  );
  // A title order has no time to group by.
  assert.deepEqual(buildLawBrowseViewModel({ sort: 'title' }, catalog).groups, []);
  // Facet options count across the whole catalog.
  assert.deepEqual(oldest.kindOptions, [{ value: snapshots[0]!.kind, count: 4 }]);
  assert.equal(
    lawBrowseHref({
      q: 'voting',
      kind: 'statute',
      topic: 'voting',
      status: 'in_force',
      sort: 'recent',
    }),
    '/law?q=voting&kind=statute&topic=voting&status=in_force&sort=recent',
  );
  assert.equal(lawBrowseHref({ kind: 'all', sort: 'chronological' }), '/law');
});

test('detail neighbors follow the index default order', () => {
  const view = buildLawDetailViewModel('fourteenth-amendment', source);
  assert.equal(view.kind, 'ok');
  if (view.kind === 'ok') {
    assert.equal(view.previous?.slug, 'thirteenth-amendment');
    assert.equal(view.next?.slug, 'fifteenth-amendment');
  }
});
