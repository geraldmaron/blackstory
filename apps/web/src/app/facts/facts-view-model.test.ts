import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSeedFactSearchIndex, listSeedFacts } from '../../data/facts-seed';
import { buildFactLibraryViewModel } from './facts-view-model';

function seedConfidenceById(): Record<string, string> {
  return Object.fromEntries(listSeedFacts().map((fact) => [fact.id, fact.confidence]));
}
import {
  parseFactIdParam,
  resolveFactRevision,
  resolvePublicFact,
} from './resolve-public-fact';
import { buildFactJsonExport } from './fact-json';
import { assertNeverClaimReview } from '@black-book/domain';

test('buildFactLibraryViewModel returns only published/corrected facts from the seed index', () => {
  const { docs } = getSeedFactSearchIndex();
  const view = buildFactLibraryViewModel({}, docs, seedConfidenceById());
  assert.ok(view.totalMatched >= 1);
  assert.ok(view.results.every((result) => result.id.startsWith('BB-F-')));
  // BB-F-000007 is a draft not yet part of the published record, so it never reaches the index.
  assert.ok(!view.results.some((result) => result.id === 'BB-F-000007'));
});

test('buildFactLibraryViewModel filters by claim type', () => {
  const { docs } = getSeedFactSearchIndex();
  const confidenceById = seedConfidenceById();
  const all = buildFactLibraryViewModel({}, docs, confidenceById);
  const events = buildFactLibraryViewModel({ claimType: 'event' }, docs, confidenceById);
  assert.ok(events.totalMatched < all.totalMatched);
  assert.equal(events.totalMatched, 3);
  assert.ok(
    events.results.every((result) => ['BB-F-000001', 'BB-F-000005', 'BB-F-000006'].includes(result.id)),
  );
});

test('buildFactLibraryViewModel filters by exact confidence grade', () => {
  const { docs } = getSeedFactSearchIndex();
  const confidenceById = seedConfidenceById();
  const established = buildFactLibraryViewModel({ confidence: 'established' }, docs, confidenceById);
  assert.equal(established.totalMatched, 2);
  assert.ok(established.results.every((result) => ['BB-F-000001', 'BB-F-000003'].includes(result.id)));
  const corroborated = buildFactLibraryViewModel({ confidence: 'corroborated' }, docs, confidenceById);
  assert.equal(corroborated.totalMatched, 3);
  assert.ok(
    corroborated.results.every((result) => ['BB-F-000002', 'BB-F-000005', 'BB-F-000006'].includes(result.id)),
  );
});

test('resolvePublicFact returns not_public for draft facts and ok for published facts', () => {
  assert.equal(resolvePublicFact('BB-F-000007').kind, 'not_public');
  assert.equal(resolvePublicFact('BB-F-000001').kind, 'ok');
  assert.equal(resolvePublicFact('not-an-id').kind, 'not_found');
});

test('resolvePublicFact redirects stale cosmetic slugs', () => {
  const resolved = resolvePublicFact('BB-F-000001', 'stale-slug');
  assert.equal(resolved.kind, 'redirect');
  if (resolved.kind === 'redirect') {
    assert.match(resolved.destination, /\/facts\/BB-F-000001\/dunbar-founded-1870-in-church-basement$/);
  }
});

test('parseFactIdParam accepts bare ids and .json suffix segments', () => {
  assert.equal(parseFactIdParam('BB-F-000001'), 'BB-F-000001');
  assert.equal(parseFactIdParam('BB-F-000001.json'), 'BB-F-000001');
  assert.equal(parseFactIdParam('bad.json'), undefined);
});

test('resolveFactRevision resolves an existing revision and rejects unknown numbers', () => {
  assert.equal(resolveFactRevision('BB-F-000003', 2).kind, 'ok');
  assert.equal(resolveFactRevision('BB-F-000003', 99).kind, 'not_found');
});

test('buildFactJsonExport never emits ClaimReview JSON-LD', () => {
  const fact = resolvePublicFact('BB-F-000001');
  assert.equal(fact.kind, 'ok');
  if (fact.kind === 'ok') {
    const payload = buildFactJsonExport(fact.fact, 'https://example.org');
    assert.equal(payload.jsonLd['@type'], 'Article');
    assertNeverClaimReview(payload.jsonLd);
    assert.match(payload.jsonUrl, /BB-F-000001\.json$/);
  }
});
