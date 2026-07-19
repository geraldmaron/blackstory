/**
 * SSR markup smoke tests for the "why this appears" component. Exercises the REAL
 * `buildPublicWhyThisAppears` composer from `@repo/domain` rather than a hand-shaped fixture
 * object, so these tests fail if the domain composer's output shape ever drifts from what this
 * component renders. Citations must render as named sources (with hrefs when provided), never as
 * opaque "N documented sources" counts.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { buildPublicWhyThisAppears, type RelevanceEvidence } from '@repo/domain';
import { WhyThisAppears } from './WhyThisAppears';

const ACCEPTED_EVIDENCE: readonly RelevanceEvidence[] = [
  { kind: 'source', summary: 'Howard University finding aid', detail: 'Archival finding aid' },
];

test('renders the explanation and citation-linked inclusion evidence, never a score', () => {
  const result = buildPublicWhyThisAppears({
    explanation:
      'Included because archival records document this campus as a Freedmen school founded by the community.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: [
      {
        criterion: 'documented_site',
        note: 'founded year: 1870. Cited from Howard University Moorland-Spingarn Research Center.',
        evidenceIds: ['ev-1', 'ev-2'],
      },
    ],
    storyTexts: ['The community founded the school and organized mutual aid.'],
  });

  const html = renderToStaticMarkup(
    createElement(WhyThisAppears, {
      result,
      evidenceById: {
        'ev-1': {
          id: 'ev-1',
          source: 'Howard University Moorland-Spingarn Research Center — finding aid',
          label: 'Archival finding aid',
          href: 'https://dh.howard.edu/finaid_manu/74/',
        },
        'ev-2': {
          id: 'ev-2',
          source: 'HMdb.org — historical marker database',
          label: 'Historical marker',
          href: 'https://www.hmdb.org/m.asp?m=112661',
        },
      },
    }),
  );

  assert.doesNotMatch(html, /<h[12][^>]*>Why this appears/);
  assert.match(html, /Cited from external sources/);
  assert.match(html, /Included because archival records document/);
  assert.match(html, /Inclusion evidence/);
  assert.match(html, /Documented site/);
  assert.match(html, /founded year: 1870/);
  assert.match(html, /Howard University Moorland-Spingarn Research Center/);
  assert.match(html, /https:\/\/dh\.howard\.edu\/finaid_manu\/74\//);
  assert.doesNotMatch(html, /\d+ documented sources/);
  assert.doesNotMatch(html, /\b0\.\d{2,}\b/);
});

test('card variant still owns the titled Card for standalone mounts', () => {
  const result = buildPublicWhyThisAppears({
    explanation: 'Standalone card mount explanation for a documented record.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: [
      {
        criterion: 'documented_site',
        note: 'listed on: National Register. Cited from Source C.',
        evidenceIds: ['ev-1'],
      },
    ],
  });
  const html = renderToStaticMarkup(
    createElement(WhyThisAppears, {
      result,
      variant: 'card',
      evidenceById: {
        'ev-1': { id: 'ev-1', source: 'Source C', label: 'Citation C' },
      },
    }),
  );
  assert.match(html, /Why this appears/);
  assert.match(html, /Cited from external sources/);
  assert.match(html, /Source C/);
});

test('renders the shared trauma-content disclaimer only when the harm dimension is classified', () => {
  const harmResult = buildPublicWhyThisAppears({
    explanation:
      'A mob of white residents committed violence and burned down the church on the night of March 3, 1921.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: [
      {
        criterion: 'documented_site',
        note: 'site of: 1921 church burning. Cited from Source D.',
        evidenceIds: ['ev-3'],
      },
    ],
  });
  const harmHtml = renderToStaticMarkup(
    createElement(WhyThisAppears, {
      result: harmResult,
      evidenceById: {
        'ev-3': { id: 'ev-3', source: 'Source D', label: 'Primary account' },
      },
    }),
  );
  assert.match(harmHtml, /Sensitive content/);
  assert.match(harmHtml, /Coverage note/);

  const balancedResult = buildPublicWhyThisAppears({
    explanation:
      'Included because archival records document this campus as a Freedmen school founded by the community.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: [
      {
        criterion: 'community_anchor',
        note: 'hosted founding of: Preparatory High School. Cited from Source E.',
        evidenceIds: ['ev-4'],
      },
    ],
    storyTexts: ['The community founded the school and organized mutual aid alongside daily celebrations.'],
  });
  const balancedHtml = renderToStaticMarkup(
    createElement(WhyThisAppears, {
      result: balancedResult,
      evidenceById: {
        'ev-4': { id: 'ev-4', source: 'Source E', label: 'Finding aid' },
      },
    }),
  );
  assert.doesNotMatch(balancedHtml, /Sensitive content/);
  assert.doesNotMatch(balancedHtml, /Coverage note/);
});

test('renders the approved gap notice when an entity carries zero notabilityBasis items', () => {
  const html = renderToStaticMarkup(
    createElement(WhyThisAppears, {
      result: {
        explanation: 'Placeholder explanation text for a record with no recorded basis yet.',
        notabilityBasis: [],
        storyDimensions: [],
        missingPerspectiveIndicators: [],
        traumaContentNotice: { warranted: false },
      },
    }),
  );
  assert.match(html, /No inclusion evidence with linked citations has been recorded/);
});

test('shows honest gap copy when evidenceIds are present but citations are unresolved', () => {
  const result = buildPublicWhyThisAppears({
    explanation: 'Included with an evidence id that the page could not resolve to a citation.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: [
      {
        criterion: 'documented_site',
        note: 'founded year: 1900. Cited from Source A.',
        evidenceIds: ['missing-id'],
      },
    ],
  });
  const html = renderToStaticMarkup(createElement(WhyThisAppears, { result, evidenceById: {} }));
  assert.match(html, /No linked source citations for this inclusion reason yet/);
  assert.doesNotMatch(html, /\d+ documented sources/);
});
