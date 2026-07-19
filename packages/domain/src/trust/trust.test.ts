/**
 * Tests for trust JSON-LD builders and errata taxonomy guards.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertClaimReviewPathExclusive,
  buildMythClaimReviewJsonLd,
  buildNewsMediaOrganizationJsonLd,
  errataTypeFromFactRevisionChangeType,
  assertFactStatusDefinitionsComplete,
} from './index.js';

test('buildNewsMediaOrganizationJsonLd emits required Trust Project schema properties', () => {
  const jsonLd = buildNewsMediaOrganizationJsonLd({
    name: 'BlackStory',
    url: 'https://example.org',
    correctionsPolicyUrl: 'https://example.org/errata',
    verificationFactCheckingPolicyUrl: 'https://example.org/methodology#verification',
    ethicsPolicyUrl: 'https://example.org/methodology#independence',
    ownershipFundingInfoUrl: 'https://example.org/methodology#funding',
    mastheadUrl: 'https://example.org/methodology#masthead',
    actionableFeedbackPolicyUrl: 'https://example.org/corrections',
  });
  assert.equal(jsonLd['@type'], 'NewsMediaOrganization');
  assert.equal(jsonLd.correctionsPolicy, 'https://example.org/errata');
  assert.equal(jsonLd.verificationFactCheckingPolicy, 'https://example.org/methodology#verification');
});

test('assertClaimReviewPathExclusive allows only /myths/<slug> paths', () => {
  assert.doesNotThrow(() => assertClaimReviewPathExclusive('/myths/rosa-parks-was-tired'));
  assert.throws(() => assertClaimReviewPathExclusive('/facts/dunbar-founding-1870'));
  assert.throws(() => assertClaimReviewPathExclusive('/myths/'));
});

test('buildMythClaimReviewJsonLd emits ClaimReview for an allowed myths path', () => {
  const jsonLd = buildMythClaimReviewJsonLd(
    {
      pageUrl: 'https://example.org/myths/sample',
      datePublished: '2026-07-17',
      claimReviewed: 'Sample circulating claim.',
      reviewBody: 'The primary record shows otherwise.',
      claimOrigin: { name: 'Example social post', url: 'https://example.com/post' },
      ratingExplanation: 'False',
      authorName: 'BlackStory',
    },
    '/myths/sample',
  );
  assert.equal(jsonLd['@type'], 'ClaimReview');
});

test('errataTypeFromFactRevisionChangeType maps style to editors_note', () => {
  assert.equal(errataTypeFromFactRevisionChangeType('style'), 'editors_note');
  assert.equal(errataTypeFromFactRevisionChangeType('correction'), 'correction');
});

test('assertFactStatusDefinitionsComplete covers every fact status', () => {
  assert.doesNotThrow(() => assertFactStatusDefinitionsComplete());
});
