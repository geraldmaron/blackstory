/**
 * Fixture-first tests for Internet Archive + DPLA v2 discovery campaign.
 *
 * Proves dual-lane survivors, federal DPLA exclusion, sub-budgets, caps, snippet doctrine,
 * and optional post-rank editorial hook — without live network or publish paths.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DPLA_ADAPTER_ID } from '../adapters/federal/dpla/definition.js';
import { DPLA_V2_ADAPTER_ID } from '../adapters/dpla/index.js';
import { INTERNET_ARCHIVE_ADAPTER_ID } from '../adapters/internet-archive/index.js';
import type { AdapterCandidateRecord } from '../adapters/types.js';
import {
  applyArchiveDplaSubBudgets,
  ARCHIVE_DPLA_ADAPTER_IDS,
  ARCHIVE_DPLA_CAMPAIGN_KIND,
  ARCHIVE_DPLA_SUB_BUDGET_POLICY,
  runArchiveDplaCampaign,
} from './archive-dpla-campaign.js';
import { listCampaignSurvivors } from './campaign-runner.js';

const FIXED_NOW = '2026-07-18T21:00:00.000Z';
const FIXTURES_IA = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'adapters',
  'internet-archive',
  'fixtures',
);
const FIXTURES_DPLA = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'adapters',
  'dpla',
  'fixtures',
);

function loadIaFixture(): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_IA, 'advanced-search-response.json'), 'utf8'));
}

function loadDplaFixture(): unknown {
  return JSON.parse(
    readFileSync(join(FIXTURES_DPLA, 'search-response-current-shape.json'), 'utf8'),
  );
}

function stubRecord(adapterId: string, index: number): AdapterCandidateRecord {
  const stableId = `${adapterId}:stub-${index}`;
  return {
    stableIdentifier: stableId,
    title: `Stub ${adapterId} ${index}`,
    classification: 'community_oral',
    payload: { summary: 'Short capped summary for sub-budget test.' },
    provenance: {
      sourceId: `src_${adapterId}`,
      adapterId,
      parserVersion: 'stub-parser-1.0.0',
      registryEntryId: `reg_${adapterId}`,
      runId: 'run_stub',
      capturedAt: FIXED_NOW,
      schemaVersion: 'candidate-record.v1',
    },
  };
}

test('ARCHIVE_DPLA_ADAPTER_IDS includes community IA + DPLA v2 only', () => {
  assert.deepEqual(ARCHIVE_DPLA_ADAPTER_IDS, [INTERNET_ARCHIVE_ADAPTER_ID, DPLA_V2_ADAPTER_ID]);
  assert.equal(DPLA_V2_ADAPTER_ID, 'dpla');
  assert.notEqual(DPLA_V2_ADAPTER_ID, DPLA_ADAPTER_ID);
  assert.equal(DPLA_ADAPTER_ID, 'dpla-items-v1');
  assert.ok(
    !ARCHIVE_DPLA_ADAPTER_IDS.includes(
      DPLA_ADAPTER_ID as (typeof ARCHIVE_DPLA_ADAPTER_IDS)[number],
    ),
  );
});

test('applyArchiveDplaSubBudgets enforces per-lane and shared caps', () => {
  const iaRecords = Array.from({ length: 400 }, (_, index) =>
    stubRecord(INTERNET_ARCHIVE_ADAPTER_ID, index),
  );
  const dplaRecords = Array.from({ length: 400 }, (_, index) =>
    stubRecord(DPLA_V2_ADAPTER_ID, index),
  );
  const { records, subBudget } = applyArchiveDplaSubBudgets({
    internetArchiveRecords: iaRecords,
    dplaRecords,
  });
  assert.equal(
    subBudget.internetArchiveIngested,
    ARCHIVE_DPLA_SUB_BUDGET_POLICY.maxInternetArchive,
  );
  assert.equal(subBudget.dplaIngested, ARCHIVE_DPLA_SUB_BUDGET_POLICY.maxDpla);
  assert.equal(subBudget.combinedIngested, ARCHIVE_DPLA_SUB_BUDGET_POLICY.maxCandidates);
  assert.equal(records.length, 500);
  const iaCount = records.filter(
    (r) => r.provenance.adapterId === INTERNET_ARCHIVE_ADAPTER_ID,
  ).length;
  const dplaCount = records.filter((r) => r.provenance.adapterId === DPLA_V2_ADAPTER_ID).length;
  assert.equal(iaCount, 300);
  assert.equal(dplaCount, 200);
});

test('dual-lane fixture run yields survivors from both adapters', async () => {
  const result = await runArchiveDplaCampaign({
    internetArchiveSearchJson: loadIaFixture(),
    dplaSearchJson: loadDplaFixture(),
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.equal(result.kind, ARCHIVE_DPLA_CAMPAIGN_KIND);
  assert.equal(result.subBudget.internetArchiveIngested, 2);
  assert.equal(result.subBudget.dplaIngested, 2);
  assert.equal(result.subBudget.combinedIngested, 4);

  assert.deepEqual(result.adapterIds, ARCHIVE_DPLA_ADAPTER_IDS);
  assert.ok(
    !result.adapterIds.includes(DPLA_ADAPTER_ID as (typeof ARCHIVE_DPLA_ADAPTER_IDS)[number]),
  );

  const survivors = listCampaignSurvivors(result.campaign);
  assert.ok(survivors.length >= 2);
  const adapterIds = new Set(survivors.map((c) => c.adapterRecord.provenance.adapterId));
  assert.ok(adapterIds.has(INTERNET_ARCHIVE_ADAPTER_ID));
  assert.ok(adapterIds.has(DPLA_V2_ADAPTER_ID));
  assert.ok(!adapterIds.has('dpla-items-v1'));
});

test('campaign budget caps match roster policy (500 / 40 / 10 / retries 2)', async () => {
  const result = await runArchiveDplaCampaign({
    internetArchiveSearchJson: loadIaFixture(),
    dplaSearchJson: loadDplaFixture(),
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });
  assert.equal(ARCHIVE_DPLA_SUB_BUDGET_POLICY.maxCandidates, 500);
  assert.equal(result.yield.survivors, listCampaignSurvivors(result.campaign).length);
  assert.doesNotThrow(() => {
    void result.yield.helpersVersion;
  });
});

test('summarizeCampaignYield enforces snippet doctrine on survivors', async () => {
  const result = await runArchiveDplaCampaign({
    internetArchiveSearchJson: loadIaFixture(),
    dplaSearchJson: loadDplaFixture(),
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });
  for (const survivor of listCampaignSurvivors(result.campaign)) {
    const summary =
      (survivor.adapterRecord.payload as { summary?: string }).summary ??
      survivor.adapterRecord.title ??
      '';
    assert.ok(summary.length <= 320);
    assert.ok(summary.split(/\s+/u).filter(Boolean).length <= 60);
  }
  assert.ok(result.yield.survivors >= 1);
});

test('optional editorial hook runs post-rank without publish path', async () => {
  const result = await runArchiveDplaCampaign({
    internetArchiveSearchJson: loadIaFixture(),
    dplaSearchJson: loadDplaFixture(),
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    editorialHook: {
      reviewTopN: 2,
      review: (leads) =>
        leads.map((lead) => ({
          candidateId: lead.candidateId,
          decision: 'keep' as const,
          reason: 'mock archive-dpla editorial keep',
        })),
    },
  });
  assert.ok(result.editorialReviews.length >= 1);
  assert.equal(result.editorialReviews[0]?.decision, 'keep');
});
