/**
 * SSR smoke tests for trust components — technique-based copy, disclaimer integration, and
 * accessibility roles.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { getDisclaimer } from '@repo/domain/disclaimers';
import type { FactCounterClaim, FactRecord } from '@repo/domain/facts';
import {
  CommonMisreadings,
  ConfidenceLabelWithNuance,
  HowToReadThisRecord,
  RevisionUpdateChrome,
  TrustSiteDisclaimer,
} from './index';

const SAMPLE_COUNTER_CLAIMS: readonly FactCounterClaim[] = [
  {
    misreading: 'The school was founded in 1916 when it took the Dunbar name.',
    refutation:
      'Primary records show an 1870 founding under an earlier name; 1916 is a rename tied to a new building.',
  },
];

const MULTI_REVISION_FACT: Pick<FactRecord, 'id' | 'updatedAt' | 'revisions' | 'status'> = {
  id: 'BB-F-000003',
  updatedAt: '2026-07-16T15:00:00.000Z',
  status: 'corrected',
  revisions: [
    {
      revisionNumber: 1,
      timestamp: '2026-07-01T12:00:00.000Z',
      changeType: 'update',
      summary: 'Initial published statement',
      agent: { type: 'user', id: 'editor' },
      diff: [],
    },
    {
      revisionNumber: 2,
      timestamp: '2026-07-16T15:00:00.000Z',
      changeType: 'correction',
      summary: 'Clarified rename vs founding',
      agent: { type: 'user', id: 'editor' },
      diff: [],
    },
  ],
};

test('HowToReadThisRecord names techniques and links to methodology', () => {
  const html = renderToStaticMarkup(createElement(HowToReadThisRecord));
  assert.match(html, /out of context/i);
  assert.match(html, /Read our full methodology/);
  assert.doesNotMatch(html, /deniers|critics/i);
});

test('HowToReadThisRecord compact variant is a one-line methodology off-ramp', () => {
  const html = renderToStaticMarkup(createElement(HowToReadThisRecord, { variant: 'compact' }));
  assert.match(html, /How this record is built/);
  assert.match(html, /read the methodology/);
  assert.doesNotMatch(html, /out of context/i);
});

test('CommonMisreadings renders counterClaims without naming people or groups', () => {
  const html = renderToStaticMarkup(
    createElement(CommonMisreadings, { counterClaims: SAMPLE_COUNTER_CLAIMS }),
  );
  assert.match(html, /You may see this described as/);
  assert.match(html, /founded in 1916/);
});

test('ConfidenceLabelWithNuance includes grade definition link and optional note', () => {
  const html = renderToStaticMarkup(
    createElement(ConfidenceLabelWithNuance, {
      confidence: 'contested',
      confidenceNote: 'Primary rolls document ~1,200; a retrospective states ~3,000.',
    }),
  );
  assert.match(html, /See grade definitions/);
  assert.match(html, /Nuance:/);
  assert.match(html, /~1,200/);
});

test('RevisionUpdateChrome links multi-revision corrections to errata', () => {
  const html = renderToStaticMarkup(createElement(RevisionUpdateChrome, { fact: MULTI_REVISION_FACT }));
  assert.match(html, /see what changed/);
  assert.match(html, /href="\/errata"/);
  assert.match(html, /role="status"/);
});

test('TrustSiteDisclaimer renders registry copy without inline ad-hoc strings', () => {
  const html = renderToStaticMarkup(createElement(TrustSiteDisclaimer));
  assert.match(html, new RegExp(getDisclaimer('site_wide').title));
  assert.match(html, /Reviewed/);
});
