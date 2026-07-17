/**
 * Domain tests for deterministic relevance engine (BB-040).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parseCandidateFixtureBatch } from './adapters/index.js';
import { ingestApiCandidate } from './discovery/index.js';
import { buildQueryPack, parseQueryPackFixture } from './query-packs/index.js';
import {
  assertExplanationHasNoNumericScore,
  assertOverrideReasonPresent,
  assertPublicRelevanceHasNoScore,
  evaluateCandidateRelevance,
  evaluateCandidateRelevanceBatch,
  loadRelevanceGoldFixture,
  toPublicRelevanceExplanation,
  validateRelevanceOverride,
} from './relevance/index.js';

const FIXED_NOW = '2026-07-16T20:00:00.000Z';
const DOMAIN_ROOT = dirname(fileURLToPath(import.meta.url));
const ADAPTER_FIXTURES = join(DOMAIN_ROOT, 'adapters', 'fixtures');
const QUERY_PACK_FIXTURES = join(DOMAIN_ROOT, 'query-packs', 'fixtures');

function loadAdapterBatch() {
  const raw = JSON.parse(readFileSync(join(ADAPTER_FIXTURES, 'valid-nara-batch.json'), 'utf8'));
  return parseCandidateFixtureBatch(raw);
}

function loadQueryPack() {
  const raw = JSON.parse(
    readFileSync(join(QUERY_PACK_FIXTURES, 'person-civil-rights-fixture.v1.json'), 'utf8'),
  );
  return parseQueryPackFixture(raw).pack;
}

function buildCandidate(title: string, candidateId: string) {
  const pack = loadQueryPack();
  const base = loadAdapterBatch()[0]!;
  const record = { ...base, title };
  return ingestApiCandidate({ record }, pack, { now: FIXED_NOW, candidateId });
}

test('included candidate has relevance evidence and policy version', () => {
  const candidate = buildCandidate(
    'Montgomery civil rights activist during segregation',
    'rel_include',
  );
  const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });

  assert.equal(assessment.decision, 'include');
  assert.equal(assessment.passes, true);
  assert.equal(assessment.policyVersion, '1.0.0');
  assert.ok(assessment.evidence.length > 0);
  assert.ok(assessment.featureValues.length === 5);
  assert.ok(assessment.whyThisAppears.length > 0);
  assert.match(assessment.whyThisAppears, /Included because/);
});

test('weak signals cannot independently pass include relevance', () => {
  const pack = buildQueryPack({
    id: 'qp-weak-only',
    displayName: 'Weak only',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt: FIXED_NOW,
    terms: [{ text: 'Montgomery', termClass: 'geographic' }],
  });
  const base = loadAdapterBatch()[0]!;
  const candidate = ingestApiCandidate(
    { record: { ...base, title: 'Montgomery community bulletin' } },
    pack,
    { now: FIXED_NOW, candidateId: 'rel_weak' },
  );

  const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });
  assert.notEqual(assessment.decision, 'include');
  assert.equal(candidate.signals.strength, 'weak');
  assert.ok(assessment.compositeScore <= 0.5);
});

test('accurate but irrelevant candidates are excluded', () => {
  const candidate = buildCandidate('unrelated marine biology field guide', 'rel_irrelevant');
  const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });

  assert.equal(assessment.decision, 'exclude');
  assert.equal(assessment.passes, true);
  assert.ok(assessment.exclusionReason?.includes('No query-pack terms matched'));
});

test('negative-only off-scope signal is excluded', () => {
  const candidate = buildCandidate('sports biography of a quarterback', 'rel_negative');
  const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });

  assert.equal(assessment.decision, 'exclude');
  assert.ok(assessment.gates.some((gate) => gate.gateId === 'negative_only' && !gate.passed));
});

test('geographic-only weak signal becomes supporting context', () => {
  const candidate = buildCandidate('Montgomery city council budget report', 'rel_geo_only');
  const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });

  assert.equal(assessment.decision, 'supporting_context');
  assert.equal(assessment.passes, true);
});

test('public projection hides numeric relevance scores', () => {
  const candidate = buildCandidate(
    'Montgomery civil rights activist during segregation',
    'rel_public',
  );
  const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });
  const publicExplanation = toPublicRelevanceExplanation(assessment);

  assertPublicRelevanceHasNoScore(publicExplanation, assessment);
  assertExplanationHasNoNumericScore(publicExplanation.whyThisAppears);
  assert.equal('compositeScore' in publicExplanation, false);
  assert.equal('featureValues' in publicExplanation, false);
});

test('manual override requires a substantive reason', () => {
  assert.throws(() => assertOverrideReasonPresent('too short'));
  assert.throws(() =>
    validateRelevanceOverride({
      decision: 'include',
      reason: 'nope',
      overriddenBy: 'reviewer',
      overriddenAt: FIXED_NOW,
    }),
  );

  const override = validateRelevanceOverride({
    decision: 'include',
    reason: 'Archival review confirms direct civil-rights connection.',
    overriddenBy: 'reviewer@example.com',
    overriddenAt: FIXED_NOW,
  });
  assert.ok(override.reason.length >= 12);
});

test('duplicate of included candidate is excluded', () => {
  const included = buildCandidate(
    'Montgomery civil rights activist during segregation',
    'rel_dup_a',
  );
  const duplicateRecord = {
    ...loadAdapterBatch()[0]!,
    title: 'Montgomery civil rights activist during segregation',
    provenance: {
      ...loadAdapterBatch()[0]!.provenance,
      runId: 'run_dup',
      capturedAt: '2026-07-17T01:00:00.000Z',
    },
  };
  const duplicate = ingestApiCandidate(
    { record: duplicateRecord },
    loadQueryPack(),
    { now: FIXED_NOW, candidateId: 'rel_dup_b' },
  );

  const assessments = evaluateCandidateRelevanceBatch([included, duplicate], {
    assessedAt: FIXED_NOW,
  });
  assert.equal(assessments[0]?.decision, 'include');
  assert.equal(assessments[1]?.decision, 'exclude');
  assert.equal(assessments[1]?.isDuplicate, true);
});

test('gold relevance fixtures pass expected decisions', () => {
  const fixture = loadRelevanceGoldFixture();
  assert.equal(fixture.schemaVersion, 'relevance-fixture.v1');

  for (const entry of fixture.cases) {
    const candidate = buildCandidate(entry.title, `rel_gold_${entry.id}`);
    const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });
    assert.equal(
      assessment.decision,
      entry.expectedDecision,
      `case ${entry.id}: expected ${entry.expectedDecision}, got ${assessment.decision}`,
    );
    assert.equal(
      assessment.passes,
      entry.expectedPasses,
      `case ${entry.id}: pass/fail mismatch`,
    );

    if (entry.expectedGateFailures?.length) {
      for (const gateId of entry.expectedGateFailures) {
        assert.ok(
          assessment.gates.some((gate) => gate.gateId === gateId && !gate.passed),
          `case ${entry.id}: expected gate failure ${gateId}`,
        );
      }
    }

    if (entry.mustNotExposeScore) {
      const publicExplanation = toPublicRelevanceExplanation(assessment);
      assertPublicRelevanceHasNoScore(publicExplanation, assessment);
    }
  }
});
