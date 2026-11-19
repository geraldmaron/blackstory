/**
 * Every /law chronology row carries year, name, jurisdiction and a gloss. None is silently
 * omitted when the underlying data lacks it; a missing field renders an explicit "unknown"
 * instead of a blank cell. The citation lives on the detail page.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LawBrowseSections, jurisdictionLabel } from './LawBrowseSections';
import { LAW_UNDATED, lawEraFor, type LawBrowseViewModel } from './law-view-model';
import type { LegalSnapshotDocument } from '../../lib/legal/public-source';

void React;

const CITATION_FULL = 'Pub. L. No. 88-352, 78 Stat. 241 (1964)';
const CITATION_SPARSE = 'S.B. 1, 1868 Sess. (State X 1868)';

const catalog = [
  {
    id: 'full',
    slug: 'full-entry',
    kind: 'federal-statute',
    title: 'Full Entry Act',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['voting'],
    citation: {
      canonicalCitation: CITATION_FULL,
      licenseTag: 'public-domain',
      archive: {
        sourceUrl: 'https://example.gov/full',
        archivedCaptureUrl: 'https://web.archive.org/web/x/https://example.gov/full',
        retrievedAt: '2026-08-01T00:00:00.000Z',
      },
    },
    externalIds: [{ source: 'test', externalId: 'full' }],
    effectiveYear: 1964,
  },
  {
    id: 'sparse',
    slug: 'sparse-entry',
    kind: 'state-statute',
    title: 'Sparse Entry Act',
    jurisdictionId: 'jurisdiction-unresolvable',
    lawStatus: 'repealed',
    topics: ['housing'],
    citation: {
      canonicalCitation: CITATION_SPARSE,
      licenseTag: 'link-only',
      archive: {
        sourceUrl: 'https://example.gov/sparse',
        archivedCaptureUrl: 'https://web.archive.org/web/x/https://example.gov/sparse',
        retrievedAt: '2026-08-01T00:00:00.000Z',
      },
    },
    externalIds: [{ source: 'test', externalId: 'sparse' }],
    // No effectiveYear.
  },
] as unknown as readonly LegalSnapshotDocument[];

const items: LawBrowseViewModel['items'] = [
  {
    id: 'full',
    slug: 'full-entry',
    title: 'Full Entry Act',
    kind: 'federal-statute',
    citation: CITATION_FULL,
    lawStatus: 'in_force',
    topics: ['voting'],
    hasExplainer: true,
    summary: 'This law does a specific, plainly stated thing.',
    effectiveYear: 1964,
  },
  {
    id: 'sparse',
    slug: 'sparse-entry',
    title: 'Sparse Entry Act',
    kind: 'state-statute',
    citation: CITATION_SPARSE,
    lawStatus: 'repealed',
    topics: ['housing'],
    hasExplainer: false,
    // No summary, no effectiveYear: exercises the explicit-unknown paths.
  },
];

const view: LawBrowseViewModel = {
  q: '',
  kind: 'all',
  topic: 'all',
  status: 'all',
  sort: 'chronological',
  items,
  groups: [
    { era: lawEraFor(1964), items: [items[0]!] },
    { era: LAW_UNDATED, items: [items[1]!] },
  ],
  totalMatched: 2,
  totalAvailable: 2,
  isFiltered: false,
  kindOptions: [
    { value: 'federal-statute', count: 1 },
    { value: 'state-statute', count: 1 },
  ],
  topicOptions: [
    { value: 'housing', count: 1 },
    { value: 'voting', count: 1 },
  ],
  statusOptions: [
    { value: 'in_force', count: 1 },
    { value: 'repealed', count: 1 },
  ],
  sortOptions: [{ value: 'chronological', label: 'Oldest first' }],
};

test('jurisdictionLabel resolves federal and state ids, and names what it cannot resolve', () => {
  assert.equal(jurisdictionLabel('us'), 'Federal');
  assert.equal(jurisdictionLabel('us-13'), 'Georgia');
  assert.equal(jurisdictionLabel('not-a-real-id'), 'Unknown jurisdiction');
});

test('every row renders year, name, jurisdiction and a gloss, grouped under its era', () => {
  const html = renderToStaticMarkup(<LawBrowseSections view={view} catalog={catalog} />);

  // Full row: real year, real jurisdiction, real gloss, under the era its year falls in.
  assert.match(html, /<h2 class="ds-law-era__title" id="era-civil-rights">Civil rights era/);
  assert.match(html, /ds-law-row__year">1964</);
  assert.match(html, /Federal/);
  assert.match(html, /This law does a specific, plainly stated thing\./);
  assert.match(html, /href="\/law\/full-entry"/);

  // Sparse row: missing fields render an explicit unknown rather than being dropped.
  assert.match(html, /Year unknown/);
  assert.match(html, /Unknown jurisdiction/);
  assert.match(html, /No plain-language summary yet\./);
  assert.match(html, /id="era-undated">Year not recorded/);

  // The citation is the detail page's; the index does not repeat it.
  assert.doesNotMatch(html, /Pub\. L\. No\. 88-352/);
});

test("the toolbar is the register's: Kind, Topic, Status and Sort as popover menus of links", () => {
  const html = renderToStaticMarkup(<LawBrowseSections view={view} catalog={catalog} />);
  for (const key of ['kind', 'topic', 'status', 'sort']) {
    assert.match(html, new RegExp(`id="records-menu-${key}"`));
  }
  assert.match(html, /aria-label="Sort: Oldest first"/);
  assert.match(html, /href="\/law\?kind=federal-statute"/);
  assert.match(html, /Federal statute/);
  assert.doesNotMatch(html, /<form|<input/);
});

test('the time axis is a picture: one unlinked mark per dated entry, no jump row', () => {
  const html = renderToStaticMarkup(<LawBrowseSections view={view} catalog={catalog} />);
  assert.match(html, /<div class="ds-law-axis" aria-hidden="true">/);
  assert.doesNotMatch(html, /ds-law-axis__eras|href="#era-/);
  // One mark per dated entry; the undated one has no place on a time axis.
  assert.equal(html.match(/<span class="ds-law-axis__mark"/g)?.length, 1);
});

test('lawEraFor places a year in its era by inclusive bounds', () => {
  assert.equal(lawEraFor(1865).id, 'reconstruction');
  assert.equal(lawEraFor(1877).id, 'reconstruction');
  assert.equal(lawEraFor(1896).id, 'jim-crow');
  assert.equal(lawEraFor(1954).id, 'civil-rights');
  assert.equal(lawEraFor(1969).id, 'since-1969');
  assert.equal(lawEraFor(1850).id, 'before-1865');
  assert.equal(lawEraFor(undefined).id, 'undated');
});

test('the not-legal-advice and jurisdiction-is-not-a-location line renders as visible text', () => {
  const html = renderToStaticMarkup(<LawBrowseSections view={view} catalog={catalog} />);
  assert.match(html, /not legal advice/);
  assert.match(
    html,
    /A jurisdiction is the reach of the authority\s+that passed a law, not a place/,
  );
  // Visible prose, not a <title> attribute or an aria-only string.
  assert.doesNotMatch(html, /<[^>]+title="[^"]*jurisdiction is the reach[^"]*"/i);
});

test('an empty result set names the active filters and offers to clear them', () => {
  const filteredEmpty: LawBrowseViewModel = {
    ...view,
    kind: 'federal-statute',
    isFiltered: true,
    items: [],
    groups: [],
    totalMatched: 0,
  };
  const html = renderToStaticMarkup(<LawBrowseSections view={filteredEmpty} catalog={catalog} />);
  assert.match(html, /No laws match/);
  assert.match(html, /Nothing in the catalog matches Federal statute\./);
  assert.match(html, /href="\/law"/);
});

test('an empty catalog is a load failure, not an empty list of laws', () => {
  const none: LawBrowseViewModel = {
    ...view,
    items: [],
    groups: [],
    totalMatched: 0,
    totalAvailable: 0,
  };
  const html = renderToStaticMarkup(<LawBrowseSections view={none} catalog={[]} />);
  assert.match(html, /The law catalog did not load/);
  assert.doesNotMatch(html, /No laws match/);
});
