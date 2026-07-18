/**
 * SSR markup smoke tests for the "why this appears" component. Exercises the REAL
 * `buildPublicWhyThisAppears` composer from `@blap/domain` rather than a hand-shaped fixture
 * object, so these tests fail if the domain composer's output shape ever drifts from what this
 * component renders.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { buildPublicWhyThisAppears, type RelevanceEvidence } from '@blap/domain';
import { WhyThisAppears } from './WhyThisAppears';

const ACCEPTED_EVIDENCE: readonly RelevanceEvidence[] = [
  { kind: 'thematic', summary: 'Thematic term classes matched.', detail: 'freedmen, schools' },
  { kind: 'geographic', summary: 'Geographic place connection detected.', detail: 'Washington, D.C.' },
];

test('renders the explanation and an auditable notabilityBasis list, never a score', () => {
  const result = buildPublicWhyThisAppears({
    explanation:
      'Included because archival records document this campus as a Freedmen school founded by the community.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: [
      {
        criterion: 'documented_site',
        note: 'Primary-source evidence ties this campus to a documented Freedmen school.',
        evidenceIds: ['ev-1', 'ev-2'],
      },
    ],
    storyTexts: ['The community founded the school and organized mutual aid.'],
  });

  const html = renderToStaticMarkup(createElement(WhyThisAppears, { result }));

  assert.match(html, /Why this appears/);
  assert.match(html, /Auditable basis/);
  assert.match(html, /Included because archival records document/);
  assert.match(html, /Notability basis/);
  assert.match(html, /Documented site/);
  assert.match(html, /Primary-source evidence ties this campus/);
  assert.match(html, /2 documented sources/);
  // The heading copy explicitly reassures "not a score" assert no actual numeric SCORE VALUE
  // (a decimal like 0.82) ever renders, rather than banning the reassurance word itself.
  assert.doesNotMatch(html, /\b0\.\d{2,}\b/);
});

test('renders the shared trauma-content disclaimer only when the harm dimension is classified', () => {
  const harmResult = buildPublicWhyThisAppears({
    explanation:
      'A mob of white residents committed violence and burned down the church on the night of March 3, 1921.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: [
      { criterion: 'documented_site', note: 'Documented site of the 1921 event.', evidenceIds: ['ev-3'] },
    ],
  });
  const harmHtml = renderToStaticMarkup(createElement(WhyThisAppears, { result: harmResult }));
  assert.match(harmHtml, /Sensitive content/);
  assert.match(harmHtml, /Coverage note/);

  const balancedResult = buildPublicWhyThisAppears({
    explanation:
      'Included because archival records document this campus as a Freedmen school founded by the community.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: [
      { criterion: 'community_anchor', note: 'Documented multi-decade community anchor role.', evidenceIds: ['ev-4'] },
    ],
    storyTexts: ['The community founded the school and organized mutual aid alongside daily celebrations.'],
  });
  const balancedHtml = renderToStaticMarkup(createElement(WhyThisAppears, { result: balancedResult }));
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
  assert.match(html, /No notability basis has been recorded for this record yet\./);
});
