/**
 * Tests for article hydration: reference numbering (inline + data-block
 * provenance, deduped by URL) and block resolution/dropping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicArticleProjectionDoc } from '@repo/schemas';
import type { ThemeImpactPacketView } from '@repo/domain';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
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
  kind: 'chapter',
  tags: [],
  title: 'Test',
  summary: 'A test article.',
  publishedAt: '2026-07-26',
  eraLabel: '1940',
  placeLabel: 'US',
  body: [
    { type: 'paragraph', text: 'The manual said so [ref:census].' },
    {
      type: 'stat',
      packetId: 'p1',
      kind: 'observation',
      refId: 'obs1',
      caption: 'Black rate, 1940.',
    },
    { type: 'figure', packetId: 'p1', caption: 'Rates over time.' },
  ],
  references: [
    {
      id: 'census',
      label: 'U.S. Census Bureau, homeownership tables.',
      url: 'https://census.gov/manual',
    },
  ],
  relatedEntityIds: [],
};

test('inline citation and matching packet provenance dedupe to one numbered reference', () => {
  const { references, refNumberById } = buildArticleReferences(doc, new Map([['p1', packet]]));
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

test("a mapInset block carries the entity's own violence-adjacency signal through (SP-26, repo-92n2.33)", () => {
  // MapInsetMoment (the room kit's map moment, threaded through ArticleBody) derives PLATE - STILL
  // from these fields via `resolveMomentPlain`. Before this test existed, hydrate.ts's mapInset
  // case discarded topicTags/topicIds/kind/displayName entirely, so a chapter's map inset for a
  // lynching or massacre entity had no way to render as anything but PLATE - LIVE.
  const violentEntity: PublicEntityView = {
    ...listPublicEntities()[0]!,
    id: 'ent_test_duluth_1920',
    kind: 'event',
    displayName: 'Duluth lynchings',
    topicTags: ['Lynching'],
    geoAnchor: { lat: 46.7867, lng: -92.1005, geohash: 'test', matchMethod: 'geocode_other' },
    locationPrecision: 'city',
  };
  const mapInsetDoc: PublicArticleProjectionDoc = {
    ...doc,
    body: [{ type: 'mapInset', entityId: violentEntity.id }],
  };

  const article = hydrateArticle(mapInsetDoc, [], [violentEntity]);
  assert.deepEqual(
    article.blocks.map((b) => b.type),
    ['mapInset'],
  );
  const mapInset = article.blocks.find((b) => b.type === 'mapInset');
  assert.ok(mapInset && mapInset.type === 'mapInset');
  assert.deepEqual(mapInset.topicTags, ['Lynching']);
  assert.equal(mapInset.kind, 'event');
  assert.equal(mapInset.displayName, 'Duluth lynchings');
});

test('a mapInset block for a non-geo-anchored entity is still dropped, unaffected by the new fields', () => {
  // The base seed entity carries no geoAnchor of its own, which is exactly the case being tested.
  const noAnchorEntity: PublicEntityView = {
    ...listPublicEntities()[0]!,
    id: 'ent_test_no_anchor',
  };
  const mapInsetDoc: PublicArticleProjectionDoc = {
    ...doc,
    body: [{ type: 'mapInset', entityId: noAnchorEntity.id }],
  };
  const article = hydrateArticle(mapInsetDoc, [], [noAnchorEntity]);
  assert.deepEqual(article.blocks, []);
});
