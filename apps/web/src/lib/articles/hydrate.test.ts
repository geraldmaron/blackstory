/**
 * Tests for article hydration: reference numbering (inline + data-block
 * provenance, deduped by URL) and block resolution/dropping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicArticleProjectionDoc } from '@repo/schemas';
import type { ThemeImpactPacketView } from '@repo/domain';
import { buildArticleReferences, hydrateArticle } from './hydrate';

const PROV = {
  source: 'us-census',
  source_url: 'https://census.gov/manual',
  retrieved_at: '2026-01-01',
  content_hash: 'abc',
  humanCitation: 'U.S. Census, homeownership.',
};

const packet: ThemeImpactPacketView = {
  packetId: 'p1',
  questionId: 'Q1',
  themeId: 'redlining',
  question: 'q',
  policyEras: [],
  geography: { unit: 'nation', label: 'US' },
  methodStance: 'juxtaposition',
  methodNote: 'note',
  observationsSummary: 'summary',
  observations: [
    {
      id: 'obs1',
      metricId: 'm1',
      label: 'Black rate',
      value: '23.6%',
      estimate: 23.6,
      unit: 'percent',
      referencePeriod: '1940',
      provenance: PROV,
    },
  ],
  derived: [],
  artifacts: [],
  gapStates: [],
};

const doc: PublicArticleProjectionDoc = {
  id: 'a1',
  releaseId: 'r1',
  slug: 'test',
  title: 'Test',
  summary: 'A test article.',
  publishedAt: '2026-07-26',
  eraLabel: '1940',
  placeLabel: 'US',
  body: [
    { type: 'paragraph', text: 'The manual said so [ref:census].' },
    { type: 'stat', packetId: 'p1', kind: 'observation', refId: 'obs1', caption: 'Black rate, 1940.' },
    { type: 'figure', packetId: 'p1', caption: 'Rates over time.' },
  ],
  references: [
    { id: 'census', label: 'U.S. Census Bureau, homeownership tables.', url: 'https://census.gov/manual' },
  ],
  relatedEntityIds: [],
};

test('inline citation and matching packet provenance dedupe to one numbered reference', () => {
  const { references, refNumberById } = buildArticleReferences(
    doc,
    new Map([['p1', packet]]),
  );
  // The inline [ref:census] and the stat/figure provenance share census.gov/manual.
  assert.equal(references.length, 1);
  assert.equal(references[0]!.number, 1);
  assert.equal(refNumberById.get('census'), 1);
  // Authored label wins over provenance humanCitation.
  assert.match(references[0]!.label, /Census Bureau, homeownership tables/);
});

test('hydrateArticle drops a stat whose packet is missing', () => {
  const article = hydrateArticle(doc, [], []);
  // paragraph stays; stat + figure drop (packet not provided).
  assert.deepEqual(
    article.blocks.map((b) => b.type),
    ['paragraph'],
  );
});

test('hydrateArticle keeps resolvable blocks and attaches source numbers', () => {
  const article = hydrateArticle(doc, [packet], []);
  assert.deepEqual(
    article.blocks.map((b) => b.type),
    ['paragraph', 'stat', 'figure'],
  );
  const stat = article.blocks.find((b) => b.type === 'stat');
  assert.ok(stat && stat.type === 'stat');
  assert.deepEqual(stat.sourceNumbers, [1]);
});
