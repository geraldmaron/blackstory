/**
 * SSR markup smoke tests for the per-claim evidence card, covering all four acceptance
 * criteria.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { buildEvidenceCard } from '../../lib/evidence';
import type { EvidenceClaimInput } from '../../lib/evidence';
import { EvidenceCard } from './EvidenceCard';

const BASE_CLAIM: EvidenceClaimInput = {
  id: 'claim_seed_001',
  predicate: 'founded_year',
  object: '1867',
  confidenceScore: 0.78,
  confidenceLevel: 'high',
  citation: {
    source: 'National Archives and Records Administration \u2014 Catalog (seed)',
    label: 'Primary archival',
    href: 'https://catalog.archives.gov/',
  },
};

test('renders an evidence-score label rather than probability language (AC1)', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceCard, { card: buildEvidenceCard(BASE_CLAIM) }),
  );
  assert.match(html, /Evidence score: high \(0\.78 of 1\.00\)/);
  assert.doesNotMatch(html, /probability/i);
});

test('associates the claim card with its citation block via aria-describedby (WCAG claim<->citation)', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceCard, { card: buildEvidenceCard(BASE_CLAIM) }),
  );
  assert.match(html, /aria-describedby="claim_seed_001-evidence-citation"/);
  assert.match(html, /id="claim_seed_001-evidence-citation"/);
});

test('renders relevance and connection-strength notes distinctly from the confidence badge (AC2)', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceCard, {
      card: buildEvidenceCard({
        ...BASE_CLAIM,
        relevanceNote: 'Documented tie to Reconstruction-era Black community history.',
        connectionStrengthNote: 'Directly named in the founding archival record.',
        researchCoverage: { level: 'partial', lastCheckedAt: '2026-06-01T00:00:00.000Z' },
        sourceLineage: { independentLineageCount: 2 },
      }),
    }),
  );
  assert.match(html, /Relevance/);
  assert.match(html, /Documented tie to Reconstruction-era Black community history\./);
  assert.match(html, /Connection strength/);
  assert.match(html, /Directly named in the founding archival record\./);
  assert.match(html, /Research coverage: <strong>Partial<\/strong>/);
  assert.match(html, /Source lineage:.*2.*independent/s);
  assert.match(html, /Last checked 2026-06-01/);
});

test('renders a preserved contradiction notice rather than silently resolving a dispute (AC3)', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceCard, {
      card: buildEvidenceCard({
        ...BASE_CLAIM,
        dispute: {
          primaryValue: '1867',
          disputed: true,
          disputeNote:
            'A credible alternate founding year (1868) is preserved; both values remain visible.',
          alternates: [{ value: '1868', credible: true, kind: 'contradicting' }],
        },
      }),
    }),
  );
  assert.match(html, /Preserved contradiction/);
  assert.match(html, /both values remain visible/);
  assert.match(html, /1868/);
});

test('does not render a dispute notice at all when there is no dispute', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceCard, { card: buildEvidenceCard(BASE_CLAIM) }),
  );
  assert.doesNotMatch(html, /Preserved contradiction/);
});

test('withholds a protected citation link and never renders the underlying URL (AC4)', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceCard, {
      card: buildEvidenceCard({
        ...BASE_CLAIM,
        citation: {
          source: 'Living-person-sensitive capture',
          label: 'Protected source',
          href: 'https://internal.example.org/should-not-leak',
          protectedFromPublicLink: true,
        },
      }),
    }),
  );
  assert.doesNotMatch(html, /internal\.example\.org/);
  assert.match(html, /Source link withheld/);
});

test('renders a withheld notice for a rights-restricted excerpt instead of the excerpt text (AC4)', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceCard, {
      card: buildEvidenceCard({
        ...BASE_CLAIM,
        excerpt: {
          text: 'This exact sentence must never render publicly.',
          excerptKind: 'substantial',
          rightsStatus: 'restricted',
        },
      }),
    }),
  );
  assert.doesNotMatch(html, /This exact sentence must never render publicly\./);
  assert.match(html, /Excerpt withheld/);
});

test('renders a visible excerpt as a blockquote when rights permit it', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceCard, {
      card: buildEvidenceCard({
        ...BASE_CLAIM,
        excerpt: {
          text: 'A public-domain sentence quoted for context.',
          excerptKind: 'short',
          rightsStatus: 'public_domain',
        },
      }),
    }),
  );
  assert.match(html, /<blockquote/);
  assert.match(html, /A public-domain sentence quoted for context\./);
});

test('does not surface raw claim ids on the public card surface', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceCard, { card: buildEvidenceCard(BASE_CLAIM) }),
  );
  assert.doesNotMatch(html, />claim_seed_001</);
  assert.match(html, /Primary archival/);
});

test('keeps claim prose in body text, not the Card title (quiet typography)', () => {
  const longObject =
    'During spring and summer 1800, Gabriel organized enslaved people across Henrico County to march on Richmond.';
  const html = renderToStaticMarkup(
    createElement(EvidenceCard, {
      card: buildEvidenceCard({
        ...BASE_CLAIM,
        predicate: 'organized',
        object: longObject,
      }),
    }),
  );
  assert.match(html, /<h3 class="ds-card__title">Organized<\/h3>/);
  assert.doesNotMatch(html, /ds-card__title">Organized: During/);
  assert.match(html, /class="ds-evidence-claim__body">During spring and summer 1800/);
});

test('renders revision history and a retraction notice when present', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceCard, {
      card: buildEvidenceCard({
        ...BASE_CLAIM,
        revisionHistory: [
          {
            id: 'rev_1',
            changedAt: '2026-05-01T00:00:00.000Z',
            changeKind: 'created',
            summary: 'Initial claim recorded.',
          },
        ],
        retraction: {
          retractedAt: '2026-07-01T00:00:00.000Z',
          reason: 'Source item was later found to be a forged document.',
        },
      }),
    }),
  );
  assert.match(html, /Revision history \(1\)/);
  assert.match(html, /Initial claim recorded\./);
  assert.match(html, /Retracted 2026-07-01/);
  assert.match(html, /forged document/);
});
