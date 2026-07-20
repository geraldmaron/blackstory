/**
 * SSR markup smoke tests for the "why this appears" component. Exercises the REAL
 * `buildPublicWhyThisAppears` composer from `@repo/domain` rather than a hand-shaped fixture
 * object, so these tests fail if the domain composer's output shape ever drifts from what this
 * component renders. Citations must render as named sources (with hrefs when provided), never as
 * opaque "N documented sources" counts. Inclusion evidence groups by criterion and dedupes sources.
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
        note: 'Founded year 1870.',
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
          source: 'Howard University Moorland-Spingarn Research Center',
          label: 'Archival finding aid',
          href: 'https://dh.howard.edu/finaid_manu/74/',
        },
        'ev-2': {
          id: 'ev-2',
          source: 'HMdb.org',
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
  assert.match(html, /Founded year 1870/);
  assert.doesNotMatch(html, /founded year:/i);
  assert.match(html, /Archival finding aid/);
  assert.match(html, /https:\/\/dh\.howard\.edu\/finaid_manu\/74\//);
  assert.doesNotMatch(html, /ds-qualify-list/);
  assert.doesNotMatch(html, /\d+ documented sources/);
  assert.doesNotMatch(html, /\b0\.\d{2,}\b/);
});

test('groups same-criterion notes and dedupes identical citations', () => {
  const result = buildPublicWhyThisAppears({
    explanation: 'Included because National Park Service records document this motel.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: [
      {
        criterion: 'documented_site',
        note: "Served as the Birmingham campaign's headquarters from Room 30.",
        evidenceIds: ['ev-nps-1'],
      },
      {
        criterion: 'documented_site',
        note: 'Bombed on May 11, 1963, the day after the truce was announced.',
        evidenceIds: ['ev-nps-2'],
      },
    ],
  });

  const html = renderToStaticMarkup(
    createElement(WhyThisAppears, {
      result,
      evidenceById: {
        'ev-nps-1': {
          id: 'ev-nps-1',
          source: 'nps.gov',
          label: 'National Park Service: The A.G. Gaston Motel',
          href: 'https://www.nps.gov/articles/ag-gaston-motel-birmingham-civil-rights-monument.htm',
        },
        'ev-nps-2': {
          id: 'ev-nps-2',
          source: 'nps.gov',
          label: 'National Park Service: The A.G. Gaston Motel',
          href: 'https://www.nps.gov/articles/ag-gaston-motel-birmingham-civil-rights-monument.htm',
        },
      },
    }),
  );

  assert.match(html, /Served as the Birmingham campaign/);
  assert.match(html, /Bombed on May 11, 1963/);
  assert.equal((html.match(/Documented site/g) ?? []).length, 1);
  assert.equal((html.match(/National Park Service: The A\.G\. Gaston Motel/g) ?? []).length, 1);
  assert.match(html, /\(nps\.gov\)/);
  assert.doesNotMatch(html, /served as:/i);
  assert.doesNotMatch(html, /Cited from nps\.gov/i);
});

test('card variant still owns the titled Card for standalone mounts', () => {
  const result = buildPublicWhyThisAppears({
    explanation: 'Standalone card mount explanation for a documented record.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: [
      {
        criterion: 'documented_site',
        note: 'Listed on National Register.',
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
  assert.match(html, /Citation C/);
});

test('renders the shared trauma-content disclaimer only when the harm dimension is classified', () => {
  const harmResult = buildPublicWhyThisAppears({
    explanation:
      'A mob of white residents committed violence and burned down the church on the night of March 3, 1921.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: [
      {
        criterion: 'documented_site',
        note: 'Site of 1921 church burning.',
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
        note: 'Hosted founding of Preparatory High School.',
        evidenceIds: ['ev-4'],
      },
    ],
    storyTexts: [
      'The community founded the school and organized mutual aid alongside daily celebrations.',
    ],
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
        note: 'Founded year 1900.',
        evidenceIds: ['missing-id'],
      },
    ],
  });
  const html = renderToStaticMarkup(createElement(WhyThisAppears, { result, evidenceById: {} }));
  assert.match(html, /No linked source citations for this inclusion reason yet/);
  assert.doesNotMatch(html, /\d+ documented sources/);
});
