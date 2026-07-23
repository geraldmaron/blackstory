/**
 * SSR smoke tests for the shared record anatomy panel (map preview + fact grid).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { RecordAnatomyPanel } from './RecordAnatomyPanel';

const here = dirname(fileURLToPath(import.meta.url));
const recordAnatomyCss = readFileSync(join(here, 'record-anatomy.css'), 'utf8');

test('record anatomy CSS keeps fact rows on one horizontal line', () => {
  assert.match(recordAnatomyCss, /\.ds-record-anatomy__facts[\s\S]*?display:\s*grid/);
  assert.match(
    recordAnatomyCss,
    /\.ds-record-anatomy__facts[\s\S]*?grid-template-columns:\s*max-content\s+minmax\(0,\s*1fr\)/,
  );
  assert.match(recordAnatomyCss, /\.ds-record-anatomy__fact[\s\S]*?display:\s*contents/);
  assert.match(recordAnatomyCss, /\.ds-record-anatomy__fact-label[\s\S]*?white-space:\s*nowrap/);
  assert.match(recordAnatomyCss, /\.ds-record-anatomy__fact-value[\s\S]*?min-width:\s*0/);
  assert.doesNotMatch(recordAnatomyCss, /\.ds-record-anatomy__fact[\s\S]*?flex-flow:\s*row\s+wrap/);
  assert.doesNotMatch(recordAnatomyCss, /\.ds-record-anatomy__fact-value[\s\S]*?flex:\s*1\s+1\s+12rem/);
});

test('renders inline fact rows without legacy column strip classes', () => {
  const html = renderToStaticMarkup(
    createElement(RecordAnatomyPanel, {
      facts: [
        {
          key: 'kind',
          label: 'Kind',
          value: 'School',
          icon: { variant: 'record-kind', kind: 'school' },
        },
        {
          key: 'where',
          label: 'Where',
          value: 'Washington, D.C.',
          icon: { variant: 'record-where' },
        },
        {
          key: 'era',
          label: 'Era',
          value: '1920s',
          icon: { variant: 'record-era' },
        },
        {
          key: 'evidence',
          label: 'Evidence',
          value: 'Grade A · 2 sources',
          icon: { variant: 'record-evidence', tier: 'high' },
        },
      ],
      place: {
        lat: 38.9098,
        lng: -77.0143,
        label: 'Dunbar High School',
        precision: 'campus',
        precisionCaption:
          'Shown at block precision. The marker represents a ±660 ft area, not an exact address.',
      },
    }),
  );

  assert.match(html, /ds-record-anatomy/);
  assert.match(html, /ds-record-anatomy__fact--inline/);
  assert.match(html, /ds-record-anatomy__fact-label/);
  assert.match(html, /ds-record-anatomy__fact-value/);
  assert.match(html, /ds-edition-fact-icon--kind-muted/);
  assert.match(html, /ds-edition-fact-icon--evidence-high/);
  assert.match(html, /Record at a glance/);
  assert.match(html, /not an exact address/);
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=38\.9098%2C-77\.0143"/);
  assert.match(html, /aria-label="Open Washington, D\.C\. in maps"/);
  assert.match(html, /ds-record-anatomy__place-link/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /target="_blank"/);
  assert.doesNotMatch(html, /ds-nc__facts-strip/);
  assert.doesNotMatch(html, /ds-home-edition__record-facts/);
});

test('renders empty place state when coordinates are unavailable', () => {
  const html = renderToStaticMarkup(
    createElement(RecordAnatomyPanel, {
      facts: [
        {
          key: 'kind',
          label: 'Kind',
          value: 'Institution',
          icon: { variant: 'record-kind', kind: 'institution' },
        },
        {
          key: 'where',
          label: 'Where',
          value: 'Place withheld',
          icon: { variant: 'record-where' },
        },
        {
          key: 'era',
          label: 'Era',
          value: 'Undated',
          icon: { variant: 'record-era' },
        },
        {
          key: 'evidence',
          label: 'Evidence',
          value: 'Unrated',
          icon: { variant: 'record-evidence', tier: 'unrated' },
        },
      ],
    }),
  );

  assert.match(html, /Place not pinned/);
  assert.match(html, /ds-record-anatomy__place--empty/);
});
