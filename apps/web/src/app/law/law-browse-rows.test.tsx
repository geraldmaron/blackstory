/**
 * SP-11d acceptance: every /law hairline row carries citation, year, jurisdiction and a gloss.
 * None is silently omitted when the underlying data lacks it; a missing field renders an
 * explicit "unknown" instead of a blank cell.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LawBrowseSections, jurisdictionLabel } from './LawBrowseSections';
import type { LawBrowseViewModel } from './law-view-model';
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

const view: LawBrowseViewModel = {
  q: '',
  kind: 'all',
  topic: 'all',
  status: 'all',
  sort: 'chronological',
  items: [
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
  ],
  totalMatched: 2,
  totalAvailable: 2,
  isFiltered: false,
  kindOptions: [
    { value: 'all', label: 'All kinds' },
    { value: 'federal-statute', label: 'federal-statute' },
    { value: 'state-statute', label: 'state-statute' },
  ],
  topicOptions: [
    { value: 'all', label: 'All topics' },
    { value: 'voting', label: 'voting' },
    { value: 'housing', label: 'housing' },
  ],
  sortOptions: [{ value: 'chronological', label: 'Oldest first' }],
};

test('jurisdictionLabel resolves federal and state ids, and names what it cannot resolve', () => {
  assert.equal(jurisdictionLabel('us'), 'Federal');
  assert.equal(jurisdictionLabel('us-13'), 'Georgia');
  assert.equal(jurisdictionLabel('not-a-real-id'), 'Unknown jurisdiction');
});

test('every row renders citation, year, jurisdiction and a gloss', () => {
  const html = renderToStaticMarkup(<LawBrowseSections view={view} catalog={catalog} />);

  // Citation is never omitted: both rows carry theirs verbatim.
  assert.match(html, new RegExp(CITATION_FULL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, new RegExp(CITATION_SPARSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  // Full row: real year, real jurisdiction, real gloss.
  assert.match(html, /1964/);
  assert.match(html, /Federal/);
  assert.match(html, /This law does a specific, plainly stated thing\./);

  // Sparse row: missing fields render an explicit unknown rather than being dropped.
  assert.match(html, /Year unknown/);
  assert.match(html, /Unknown jurisdiction/);
  assert.match(html, /No plain-language summary yet\./);
});

test('the jurisdictional-not-documented sentence renders as visible body text', () => {
  const html = renderToStaticMarkup(<LawBrowseSections view={view} catalog={catalog} />);
  assert.match(html, /the relationship is jurisdictional, not evidentiary/);
  assert.match(html, /A jurisdiction is not a location/);
  // Visible prose, not a <title> attribute or an aria-only string.
  assert.doesNotMatch(html, /<[^>]+title="[^"]*jurisdiction is not a location[^"]*"/i);
});

test('an empty result set names the active filters and offers to clear them', () => {
  const filteredEmpty: LawBrowseViewModel = {
    ...view,
    kind: 'federal-statute',
    isFiltered: true,
    items: [],
    totalMatched: 0,
  };
  const html = renderToStaticMarkup(<LawBrowseSections view={filteredEmpty} catalog={catalog} />);
  assert.match(html, /No law entries matched/);
  assert.match(html, /federal-statute/);
  assert.match(html, /href="\/law"/);
});
