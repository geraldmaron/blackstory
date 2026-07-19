/**
 * Fixture-first integration tests for Wikimedia + federal fan-out discovery campaign.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  DPLA_ADAPTER_ID,
  LOC_ADAPTER_ID,
  NARA_ADAPTER_ID,
  NPS_ADAPTER_ID,
  SCHOOL_HISTORY_ADAPTER_ID,
} from '../adapters/federal/index.js';
import { WIKIMEDIA_ADAPTER_ID } from '../adapters/wikimedia/index.js';
import {
  CAMPAIGN_RUNNER_HELPERS_VERSION,
  listCampaignSurvivors,
} from './campaign-runner.js';
import {
  computeAdapterSubBudgets,
  PARTICIPATING_ADAPTER_IDS,
  runWikimediaFederalCampaign,
  WIKIMEDIA_FEDERAL_CAMPAIGN_KIND,
  WIKIMEDIA_SUB_BUDGET_RESERVE,
} from './wikimedia-federal-campaign.js';

const FIXED_NOW = '2026-07-18T21:00:00.000Z';
const DOMAIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FEDERAL_FIXTURES_ROOT = join(DOMAIN_ROOT, 'adapters', 'federal');
const WIKIMEDIA_FIXTURE = join(
  DOMAIN_ROOT,
  'adapters',
  'wikimedia',
  'fixtures',
  'wikimedia-bulk-batch.json',
);

test('computeAdapterSubBudgets reserves wikimedia slice and splits federal remainder at 500', () => {
  const budgets = computeAdapterSubBudgets(500, PARTICIPATING_ADAPTER_IDS);
  assert.equal(budgets.get(WIKIMEDIA_ADAPTER_ID), WIKIMEDIA_SUB_BUDGET_RESERVE);
  for (const adapterId of [
    LOC_ADAPTER_ID,
    NARA_ADAPTER_ID,
    NPS_ADAPTER_ID,
    SCHOOL_HISTORY_ADAPTER_ID,
    DPLA_ADAPTER_ID,
  ]) {
    assert.equal(budgets.get(adapterId), 80);
  }
  const total = [...budgets.values()].reduce((sum, value) => sum + value, 0);
  assert.equal(total, 500);
});

test('computeAdapterSubBudgets equal-splits small budgets (max 2 per adapter when maxCandidates=10)', () => {
  const budgets = computeAdapterSubBudgets(10, PARTICIPATING_ADAPTER_IDS);
  const slices = [...budgets.values()];
  assert.equal(slices.reduce((sum, value) => sum + value, 0), 10);
  assert.ok(slices.every((slice) => slice >= 1 && slice <= 2));
});

test('fixture campaign yields survivors from wikimedia and federal families', async () => {
  const result = await runWikimediaFederalCampaign({
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    runId: 'run_wikimedia_federal_fixture',
    federalFixturesRoot: FEDERAL_FIXTURES_ROOT,
    wikimediaFixturePath: WIKIMEDIA_FIXTURE,
  });

  assert.equal(result.kind, WIKIMEDIA_FEDERAL_CAMPAIGN_KIND);
  assert.equal(result.adapterIds.length, 6);
  assert.equal(result.summary.helpersVersion, CAMPAIGN_RUNNER_HELPERS_VERSION);
  assert.ok(result.summary.survivors >= 2);

  const survivors = listCampaignSurvivors(result.campaign);
  const adapterIds = new Set(survivors.map((c) => c.adapterRecord.provenance.adapterId));
  assert.ok(adapterIds.has(WIKIMEDIA_ADAPTER_ID), 'expected wikimedia survivor');
  assert.ok(
    adapterIds.has(LOC_ADAPTER_ID) ||
      adapterIds.has(NARA_ADAPTER_ID) ||
      adapterIds.has(NPS_ADAPTER_ID) ||
      adapterIds.has(SCHOOL_HISTORY_ADAPTER_ID) ||
      adapterIds.has(DPLA_ADAPTER_ID),
    'expected at least one federal survivor',
  );
});

test('per-adapter sub-budget slices are respected before campaign ingest', async () => {
  const maxCandidates = 10;
  const budgets = computeAdapterSubBudgets(maxCandidates, PARTICIPATING_ADAPTER_IDS);
  const result = await runWikimediaFederalCampaign({
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    maxCandidates,
    federalFixturesRoot: FEDERAL_FIXTURES_ROOT,
    wikimediaFixturePath: WIKIMEDIA_FIXTURE,
  });

  for (const yieldRow of result.perAdapterYield) {
    const cap = budgets.get(yieldRow.adapterId) ?? 0;
    assert.ok(yieldRow.sliced <= cap, `${yieldRow.adapterId} sliced ${yieldRow.sliced} > cap ${cap}`);
  }
  const ingested = result.perAdapterYield.reduce((sum, row) => sum + row.sliced, 0);
  assert.ok(ingested <= maxCandidates);
});

test('survivors preserve provenance adapterIds across families', async () => {
  const result = await runWikimediaFederalCampaign({
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    federalFixturesRoot: FEDERAL_FIXTURES_ROOT,
    wikimediaFixturePath: WIKIMEDIA_FIXTURE,
  });

  const survivors = listCampaignSurvivors(result.campaign);
  for (const survivor of survivors) {
    assert.ok(
      PARTICIPATING_ADAPTER_IDS.includes(
        survivor.adapterRecord.provenance.adapterId as (typeof PARTICIPATING_ADAPTER_IDS)[number],
      ),
    );
  }
});

test('optional editorial hook reviews top survivors (mock only)', async () => {
  const result = await runWikimediaFederalCampaign({
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    federalFixturesRoot: FEDERAL_FIXTURES_ROOT,
    wikimediaFixturePath: WIKIMEDIA_FIXTURE,
    editorialHook: {
      reviewTopN: 2,
      review: (leads) =>
        leads.map((lead) => ({
          candidateId: lead.candidateId,
          decision: 'keep' as const,
          reason: 'mock editorial keep',
        })),
    },
  });

  assert.ok(result.editorial);
  assert.ok(result.editorial!.length >= 1);
  assert.equal(result.editorial![0]?.decision, 'keep');
});
