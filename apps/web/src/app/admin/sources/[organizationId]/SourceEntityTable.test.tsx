import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceEntityTable } from './SourceEntityTable';
import type { SourceEntityListItem } from '../../../../admin/sources/sources-store';

void React;

const rows: readonly SourceEntityListItem[] = [
  {
    entityId: 'ent_place_dunbar',
    entityKind: 'place',
    entityDisplayName: 'Dunbar High School',
    claimCount: 3,
    sampleCitationHref: 'https://npgallery.nps.gov/GetAsset/abc123',
  },
  {
    entityId: 'ent_person_no_sample',
    entityKind: 'person',
    entityDisplayName: 'A Record With No Sample Citation',
    claimCount: 1,
  },
];

test('renders each entity as a link to its public record with claim count and sample citation', () => {
  const markup = renderToStaticMarkup(<SourceEntityTable rows={rows} />);
  assert.match(markup, /href="\/entity\/ent_place_dunbar"/);
  assert.match(markup, /Dunbar High School/);
  assert.match(markup, /npgallery\.nps\.gov\/GetAsset\/abc123/);
  // No sample citation: the dash, not a broken link.
  assert.match(markup, /A Record With No Sample Citation/);
});

test('an empty entity list says so in plain words', () => {
  const markup = renderToStaticMarkup(<SourceEntityTable rows={[]} />);
  assert.match(markup, /No published entities cite this publisher/);
});
