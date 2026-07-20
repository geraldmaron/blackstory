/**
 * national seed campaign validators calls real notability, citation,
 * and corpus promotion gates; aligns with gold-corpus included_school patterns.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadGoldCorpus } from '@repo/testing';
import {
  ALL_SEED_RECORDS,
  NATIONAL_SEED_CAMPAIGN_BUNDLE,
  NATIONAL_SEED_MAX_RECORDS,
  SEED_CAMPAIGN_IDS,
  assertAllSeedRecordsPassGates,
  assertNationalSeedNotBulkImport,
  computeGeographicCoverage,
  countRecordsByCampaign,
  evaluateSeedRecordGates,
  validateNationalSeedCampaign,
} from './index.js';

const NOW = '2026-07-17T12:00:00.000Z';
const GATE_INPUT = { vettedBy: 'operator-gerald', vettedAt: NOW };

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLD_CORPUS_PATH = join(
  __dirname,
  '../../../testing/src/gold-corpus/fixtures/gold-corpus.v1.json',
);

test('national seed bundle validates fail-closed through all real gates', () => {
  const result = validateNationalSeedCampaign({
    records: NATIONAL_SEED_CAMPAIGN_BUNDLE.records,
    ...GATE_INPUT,
  });
  assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result, null, 2));
  if (result.ok) {
    assert.ok(result.recordCount >= 20, 'quality-first sample should still be substantive');
    assert.ok(result.recordCount <= NATIONAL_SEED_MAX_RECORDS);
  }
});

test('every seed record passes real notability and evidence gates individually', () => {
  for (const record of ALL_SEED_RECORDS) {
    const gates = evaluateSeedRecordGates(record, GATE_INPUT);
    const failed = gates.filter((entry) => !entry.passed);
    assert.deepEqual(
      failed,
      [],
      `${record.id} failed gates: ${failed.map((entry) => `${entry.gate}: ${entry.reason}`).join('; ')}`,
    );
  }
});

test('assertAllSeedRecordsPassGates is fail-closed on a record missing citations', () => {
  const [first] = ALL_SEED_RECORDS;
  assert.ok(first);
  const bad = { ...first, citations: [] as typeof first.citations };
  assert.throws(
    () => assertAllSeedRecordsPassGates([bad], GATE_INPUT),
    /validation failed|at least one citation/iu,
  );
});

test('national seed is not a bulk U.S. school import ( AC4)', () => {
  assertNationalSeedNotBulkImport(ALL_SEED_RECORDS);
  assert.ok(
    ALL_SEED_RECORDS.length < 100,
    'sample must stay orders of magnitude below school inventory',
  );
  assert.ok(ALL_SEED_RECORDS.length <= NATIONAL_SEED_MAX_RECORDS);
});

test('sparse but verified records are allowed ( AC3)', () => {
  const sparse = ALL_SEED_RECORDS.filter((record) => record.completeness === 'sparse');
  assert.ok(sparse.length >= 2, 'campaign should include at least two sparse verified records');
  for (const record of sparse) {
    const gates = evaluateSeedRecordGates(record, GATE_INPUT);
    assert.equal(
      gates.every((entry) => entry.passed),
      true,
      `${record.id} sparse record must still pass all gates`,
    );
  }
});

test('all six campaigns ship at least one verified record — quality determines count', () => {
  const counts = countRecordsByCampaign(ALL_SEED_RECORDS);
  for (const campaignId of SEED_CAMPAIGN_IDS) {
    assert.ok(counts[campaignId] >= 1, `${campaignId} must have at least one verified record`);
    assert.ok(
      counts[campaignId] <= 10,
      `${campaignId} should remain a sample, not a bulk campaign`,
    );
  }
});

test('geographic diversity spans multiple Census regions with documented gaps', () => {
  const coverage = computeGeographicCoverage(ALL_SEED_RECORDS);
  assert.ok(coverage.representedRegions.length >= 3, 'sample should span at least three regions');
  assert.ok(coverage.byRegion.South > 0);
  assert.ok(
    coverage.byRegion.Northeast > 0 || coverage.byRegion.Midwest > 0 || coverage.byRegion.West > 0,
  );

  const gapsDoc = readFileSync(join(__dirname, 'gaps.md'), 'utf8');
  assert.match(gapsDoc, /Geographic gaps/iu);
  assert.match(gapsDoc, /Thematic gaps/iu);
  assert.match(gapsDoc, /Rosenwald bulk corpus/iu);
});

test(' gold corpus included_school adjudications align with seed publication posture', () => {
  const gold = loadGoldCorpus(GOLD_CORPUS_PATH);
  const includedSchools = gold.examples.filter(
    (example) =>
      example.categories.includes('included_school') &&
      example.adjudication.relevance === 'include',
  );
  assert.ok(includedSchools.length > 0, 'gold corpus must include included_school examples');

  for (const example of includedSchools) {
    assert.equal(example.adjudication.publicationAllowed, true);
    assert.equal(example.adjudication.citationEntailed, true);
  }

  for (const record of ALL_SEED_RECORDS.filter((entry) => entry.kind === 'school')) {
    const gates = evaluateSeedRecordGates(record, GATE_INPUT);
    const evidence = gates.find((entry) => entry.gate === 'evidence');
    const notability = gates.find((entry) => entry.gate === 'notability');
    assert.equal(evidence?.passed, true, `${record.id} must pass citation evidence gate`);
    assert.equal(notability?.passed, true, `${record.id} must pass notability gate`);
  }
});

test('records with sourceCorpus use  cleared launch corpora only', () => {
  const withCorpus = ALL_SEED_RECORDS.filter((record) => record.sourceCorpus !== undefined);
  assert.ok(withCorpus.length > 0);
  for (const record of withCorpus) {
    assert.notEqual(
      record.sourceCorpus,
      'rosenwald-schools',
      'deferred Rosenwald bulk corpus must not back seed records',
    );
    const corpusGate = evaluateSeedRecordGates(record, GATE_INPUT).find(
      (entry) => entry.gate === 'corpus_promotion',
    );
    assert.equal(corpusGate?.passed, true, `${record.id} must pass  corpus promotion gate`);
  }
});

test('record counts by campaign for reporting', () => {
  const counts = countRecordsByCampaign(ALL_SEED_RECORDS);
  assert.deepEqual(Object.keys(counts).sort(), [...SEED_CAMPAIGN_IDS].sort());
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  assert.equal(total, ALL_SEED_RECORDS.length);
});
