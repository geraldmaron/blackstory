/**
 * Tests for law browse/detail view-model shaping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildLawBrowseViewModel,
  buildLawDetailViewModel,
  LAW_PAGE_SIZE,
  lawBrowseHref,
} from './law-view-model';
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
  // "347 U.S. 483 (1954)" must not be mistaken for a sentence break.
  assert.match(brown.summary, /^Brown v\. Board of Education, 347 U\.S\. 483 \(1954\),/);
  assert.ok(brown.summary.endsWith('.'));
});

test('isFiltered drives the "N of M" count only when a facet narrows the catalog', () => {
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

test('law paging preserves ordering, clamps stale pages and keeps detail neighbors across page boundaries', () => {
  const snapshots = Array.from({ length: LAW_PAGE_SIZE + 3 }, (_, i) => ({
    ...source.snapshots[0]!,
    id: `fixture-${i}`,
    slug: `fixture-${i}`,
    title: `Fixture ${String(i).padStart(3, '0')}`,
    effectiveYear: 1800 + i,
  }));
  const catalog = { snapshots, explainerFor: () => undefined };
  const first = buildLawBrowseViewModel({}, catalog);
  const second = buildLawBrowseViewModel({ page: '2' }, catalog);
  assert.equal(first.items.length, LAW_PAGE_SIZE);
  assert.equal(second.items.length, 3);
  assert.equal(second.items[0]?.id, `fixture-${LAW_PAGE_SIZE}`);
  assert.equal(second.totalMatched, LAW_PAGE_SIZE + 3);
  assert.equal(buildLawBrowseViewModel({ page: '99999' }, catalog).page, 2);
  assert.equal(buildLawBrowseViewModel({ page: 'bad' }, catalog).page, 1);
  const detail = buildLawDetailViewModel(`fixture-${LAW_PAGE_SIZE}`, catalog);
  assert.equal(detail.kind, 'ok');
  if (detail.kind === 'ok') {
    assert.equal(detail.previous?.slug, `fixture-${LAW_PAGE_SIZE - 1}`);
    assert.equal(detail.next?.slug, `fixture-${LAW_PAGE_SIZE + 1}`);
  }
  assert.equal(
    lawBrowseHref({
      q: 'voting',
      kind: 'statute',
      topic: 'voting',
      status: 'in_force',
      sort: 'recent',
      page: '2',
    }),
    '/law?q=voting&kind=statute&topic=voting&status=in_force&sort=recent&page=2',
  );
});
