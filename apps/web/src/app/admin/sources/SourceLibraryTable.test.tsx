/**
 * Renders the source library table with realistic rows and no Postgres connection, following
 * the `renderToStaticMarkup` pattern used for other admin/public row components (e.g.
 * `app/law/law-browse-rows.test.tsx`).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceLibraryTable } from './SourceLibraryTable';
import type { SourceLibraryListItem } from '../../../admin/sources/sources-store';

void React;

const rows: readonly SourceLibraryListItem[] = [
  {
    organizationId: 'org_nps',
    name: 'National Park Service — NPGallery',
    publisherKind: 'government_archive',
    tier: 'tier1',
    publishedEntities: 1987,
    publishedClaims: 5421,
    canonicalEntities: 2001,
    profileReviewedAt: '2026-08-01T00:00:00.000Z',
    profileReviewedBy: 'staff-review-team',
  },
  {
    organizationId: 'org_wikipedia',
    name: 'Wikipedia',
    publisherKind: 'wiki_crowd',
    tier: 'tier3',
    publishedEntities: 412,
    publishedClaims: 890,
    canonicalEntities: 420,
  },
  {
    organizationId: 'org_no_profile',
    name: 'Unreviewed County Historical Society',
    publishedEntities: 3,
    publishedClaims: 5,
    canonicalEntities: 3,
  },
];

const SORT_HREFS = { entities: '/admin/sources?sort=entities', name: '/admin/sources?sort=name' };

test('renders every publisher row with kind, tier, counts, and a link to the detail page', () => {
  const markup = renderToStaticMarkup(
    <SourceLibraryTable rows={rows} sort="entities" sortHrefs={SORT_HREFS} />,
  );

  assert.match(markup, /National Park Service — NPGallery/);
  assert.match(markup, /Government archive/);
  assert.match(markup, /Tier 1/);
  assert.match(markup, /1,987/);
  assert.match(markup, /href="\/admin\/sources\/org_nps"/);

  assert.match(markup, /Wiki \/ crowd-sourced/);
  assert.match(markup, /Tier 3/);

  // No profile: the org with no reviewed timestamp says so in plain words, not a blank cell.
  assert.match(markup, /Unreviewed County Historical Society/);
  assert.match(markup, /No profile/);
  assert.match(markup, /Reviewed/);
});

test('an empty result set says so in plain words instead of an empty table', () => {
  const markup = renderToStaticMarkup(
    <SourceLibraryTable rows={[]} sort="name" sortHrefs={SORT_HREFS} />,
  );
  assert.match(markup, /No publishers matched/);
  assert.doesNotMatch(markup, /<table/);
});
