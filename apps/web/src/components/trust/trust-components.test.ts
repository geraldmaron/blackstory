/**
 * SSR smoke tests for trust components technique-based copy, disclaimer integration, and
 * accessibility roles.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { getDisclaimer } from '@repo/domain/disclaimers';
import { listSeedFacts } from '../../data/facts-seed';
import {
  CommonMisreadings,
  ConfidenceLabelWithNuance,
  HowToReadThisRecord,
  RevisionUpdateChrome,
  TrustSiteDisclaimer,
} from './index';

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

test('CommonMisreadings renders counterClaims from seed facts', () => {
  const fact = listSeedFacts().find((entry) => entry.counterClaims.length > 0);
  assert.ok(fact);
  const html = renderToStaticMarkup(
    createElement(CommonMisreadings, { counterClaims: fact!.counterClaims }),
  );
  assert.match(html, /You may see this described as/);
  assert.match(html, new RegExp(fact!.counterClaims[0]!.misreading.slice(0, 20)));
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

test('RevisionUpdateChrome links to revision permalink for multi-revision facts', () => {
  const fact = listSeedFacts().find((entry) => entry.revisions.length > 1);
  assert.ok(fact);
  const html = renderToStaticMarkup(createElement(RevisionUpdateChrome, { fact: fact! }));
  assert.match(html, /see what changed/);
  assert.match(html, /role="status"/);
});

test('TrustSiteDisclaimer renders registry copy without inline ad-hoc strings', () => {
  const html = renderToStaticMarkup(createElement(TrustSiteDisclaimer));
  assert.match(html, new RegExp(getDisclaimer('site_wide').title));
  assert.match(html, /Reviewed/);
});
