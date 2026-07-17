/**
 * Domain tests for versioned historical query packs (BB-038).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  assertDiscoveryRunStamped,
  assertMayPromoteBeyondCandidate,
  assertQueryPackValid,
  buildQueryPack,
  classifySignalStrength,
  computeEffectivenessMetrics,
  computeQueryPackContentHash,
  createInMemoryEffectivenessStore,
  createInMemoryQueryPackRegistry,
  evaluateTextAgainstTerms,
  getQueryPack,
  listQueryPacks,
  mayPromoteBeyondCandidate,
  parseQueryPackFixture,
  publicSafeSummary,
  recordQueryPackMetric,
  registerQueryPack,
  resolveQueryPackForRun,
  stampDiscoveryRun,
  toPublicSafeTerms,
  toResearchQueryTerms,
  type QueryPack,
} from './query-packs/index.js';

const FIXED_NOW = '2026-07-16T20:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'query-packs', 'fixtures');

function loadFixture() {
  const raw = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'person-civil-rights-fixture.v1.json'), 'utf8'),
  );
  return parseQueryPackFixture(raw);
}

test('query pack versioning uses semver and content hash', () => {
  const pack = buildQueryPack({
    id: 'qp-test',
    displayName: 'Test pack',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt: FIXED_NOW,
    terms: [{ text: 'activist', termClass: 'positive' }],
  });
  assert.equal(pack.version.semver, '1.0.0');
  assert.match(pack.version.contentHash, /^[a-f0-9]{64}$/);
  assert.match(pack.versionId, /^1\.0\.0\+[a-f0-9]{8}$/);
  assertQueryPackValid(pack);

  const recomputed = computeQueryPackContentHash({
    id: pack.id,
    displayName: pack.displayName,
    entityKind: pack.entityKind,
    theme: pack.theme,
    semver: pack.version.semver,
    terms: pack.terms,
    notes: pack.notes,
  });
  assert.equal(recomputed, pack.version.contentHash);
});

test('content hash changes when terms change (reviewable versioning)', () => {
  const base = {
    id: 'qp-test',
    displayName: 'Test pack',
    entityKind: 'person' as const,
    theme: 'civil_rights' as const,
    semver: '1.0.0',
    createdAt: FIXED_NOW,
  };
  const v1 = buildQueryPack({
    ...base,
    terms: [{ text: 'activist', termClass: 'positive' }],
  });
  const v2 = buildQueryPack({
    ...base,
    semver: '1.0.1',
    terms: [{ text: 'activist', termClass: 'positive' }, { text: 'Montgomery', termClass: 'geographic' }],
  });
  assert.notEqual(v1.version.contentHash, v2.version.contentHash);
  assert.notEqual(v1.versionId, v2.versionId);
});

test('toPublicSafeTerms strips research-only offensive historical terms', () => {
  const terms = [
    { text: 'civil rights', termClass: 'positive' as const },
    { text: 'colored school', termClass: 'historical' as const, researchOnlyOffensive: true },
  ];
  const publicTerms = toPublicSafeTerms(terms);
  assert.equal(publicTerms.length, 1);
  assert.equal(publicTerms[0]?.text, 'civil rights');
  assert.equal(publicSafeSummary(terms).redactedCount, 1);

  const researchTerms = toResearchQueryTerms(terms);
  assert.equal(researchTerms.length, 2);
  assert.ok(researchTerms.some((term) => term.researchOnlyOffensive === true));
});

test('weak signals produce candidates only', () => {
  const negativeOnly = classifySignalStrength({
    matchedTerms: [{ text: 'sports biography', termClass: 'negative' }],
  });
  assert.equal(negativeOnly.strength, 'weak');
  assert.equal(negativeOnly.outcome, 'candidate_only');
  assert.equal(mayPromoteBeyondCandidate(negativeOnly), false);
  assert.throws(() => assertMayPromoteBeyondCandidate(negativeOnly));

  const geographicOnly = classifySignalStrength({
    matchedTerms: [{ text: 'Montgomery', termClass: 'geographic' }],
  });
  assert.equal(geographicOnly.strength, 'weak');
  assert.equal(geographicOnly.outcome, 'candidate_only');

  const strong = classifySignalStrength({
    matchedTerms: [
      { text: 'activist', termClass: 'positive' },
      { text: 'segregation', termClass: 'historical' },
    ],
  });
  assert.equal(strong.strength, 'strong');
  assert.equal(strong.outcome, 'promotable');
});

test('stampDiscoveryRun records query-pack version on every run', () => {
  const pack = loadFixture().pack;
  const stamped = stampDiscoveryRun(
    { runId: 'run_1', adapterId: 'nara-catalog-v1', startedAt: FIXED_NOW },
    pack,
    FIXED_NOW,
  );
  assert.equal(stamped.queryPackId, pack.id);
  assert.equal(stamped.queryPackVersionId, pack.versionId);
  assert.equal(stamped.queryPackSemver, pack.version.semver);
  assert.equal(stamped.queryPackContentHash, pack.version.contentHash);
  assertDiscoveryRunStamped(stamped);
});

test('query pack registry resolves by entity kind and theme', () => {
  const store = createInMemoryQueryPackRegistry();
  const pack = loadFixture().pack;
  registerQueryPack(store, pack);
  assert.equal(getQueryPack(store, pack.id)?.id, pack.id);
  assert.equal(listQueryPacks(store, { entityKind: 'person' }).length, 1);

  const resolved = resolveQueryPackForRun(store, {
    entityKind: 'person',
    theme: 'civil_rights',
  });
  assert.equal(resolved.versionId, pack.versionId);
});

test('effectiveness metrics record and aggregate', () => {
  const store = createInMemoryEffectivenessStore();
  const pack = loadFixture().pack;
  recordQueryPackMetric(store, {
    packId: pack.id,
    versionId: pack.versionId,
    runId: 'run_a',
    recordedAt: FIXED_NOW,
    queriesExecuted: 100,
    matchesObserved: 20,
    exclusionsObserved: 5,
    falsePositiveObserved: 2,
  });
  recordQueryPackMetric(store, {
    packId: pack.id,
    versionId: pack.versionId,
    runId: 'run_b',
    recordedAt: FIXED_NOW,
    queriesExecuted: 50,
    matchesObserved: 8,
    exclusionsObserved: 1,
    falsePositiveObserved: 1,
  });

  const metrics = computeEffectivenessMetrics({
    packId: pack.id,
    versionId: pack.versionId,
    records: store.records,
  });
  assert.equal(metrics.recordCount, 2);
  assert.equal(metrics.totalQueries, 150);
  assert.equal(metrics.totalMatches, 28);
  assert.ok(metrics.matchRate > 0);
  assert.ok(metrics.effectivenessScore >= 0);
});

test('fixture expectations for matches and exclusions', () => {
  const fixture = loadFixture();
  const { pack, expectations } = fixture;

  for (const expectation of expectations) {
    const matched = evaluateTextAgainstTerms(expectation.input, pack.terms);
    const didMatch = matched.length > 0;
    assert.equal(
      didMatch,
      expectation.shouldMatch,
      `Expected shouldMatch=${expectation.shouldMatch} for input: ${expectation.input}`,
    );

    if (didMatch && expectation.expectedOutcome) {
      const classification = classifySignalStrength({ matchedTerms: matched });
      assert.equal(
        classification.outcome,
        expectation.expectedOutcome,
        `Outcome mismatch for: ${expectation.input}`,
      );
    }

    if (didMatch && expectation.matchedTermClasses) {
      const classes = new Set(matched.map((term) => term.termClass));
      for (const expectedClass of expectation.matchedTermClasses) {
        assert.ok(classes.has(expectedClass), `Missing class ${expectedClass} for: ${expectation.input}`);
      }
    }
  }
});

test('source_specific terms require sourceId', () => {
  assert.throws(() =>
    buildQueryPack({
      id: 'qp-bad',
      displayName: 'Bad',
      entityKind: 'person',
      theme: 'civil_rights',
      semver: '1.0.0',
      createdAt: FIXED_NOW,
      terms: [{ text: 'naid:', termClass: 'source_specific' }],
    }),
  );
});

test('public projection of fixture pack excludes offensive historical terms', () => {
  const pack: QueryPack = loadFixture().pack;
  const publicTerms = toPublicSafeTerms(pack.terms);
  assert.ok(!publicTerms.some((term) => term.text === 'colored school'));
  assert.ok(publicTerms.some((term) => term.text === 'civil rights activist'));
});
