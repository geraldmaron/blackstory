/**
 * BB-073 acceptance criterion 1 (the isolation half): proves canary sampling, drift-quarantine,
 * and kill-switch machinery — all generic BB-037 primitives (../gates.ts, ../run-health.ts,
 * ../drift.ts) — compose correctly with each of the three new adapter contracts (RSS, Internet
 * Archive, DPLA v2), the same isolation BB-045/046 already rely on. Unlike the federal adapter
 * family, these three don't get a bespoke `buildIsolatedFederalRunResult`-style wrapper — the
 * generic primitives already cover the need, so this test exercises them directly against each
 * contract rather than duplicating a wrapper.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertAdapterMayRun,
  canAdapterRun,
  evaluateRunHealth,
  isCanaryMode,
  selectCanaryRecordIndices,
  shouldDeadLetterRun,
  shouldQuarantineRun,
  type SourceRegistryEntry,
} from '../index.js';
import { createRssAdapterContract, RSS_ADAPTER_ID } from './../rss/index.js';
import { createInternetArchiveAdapterContract, INTERNET_ARCHIVE_ADAPTER_ID } from './index.js';
import { createDplaV2AdapterContract, DPLA_V2_ADAPTER_ID } from './../dpla/index.js';
import type { SourceAdapterContract } from '../types.js';

const FIXED_NOW = '2026-07-17T20:00:00.000Z';

function entryFor(contract: SourceAdapterContract, adapterId: string, registryState: SourceRegistryEntry['registryState']): SourceRegistryEntry {
  return {
    id: `reg_${adapterId}`,
    contract,
    evidenceSource: {
      id: `src_${adapterId}`,
      displayName: contract.displayName,
      classification: contract.classification,
      adapterId,
      stableIdScheme: contract.stableIdScheme,
      policy: contract.policy,
      adapterEnabled: true,
      killSwitchId: `adapter:${adapterId}`,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    registryState,
    ...(registryState === 'approved' || registryState === 'canary'
      ? { approvedAt: FIXED_NOW, approvedBy: 'admin@blackbook.local' }
      : {}),
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

const CONTRACTS: readonly [string, SourceAdapterContract][] = [
  [RSS_ADAPTER_ID, createRssAdapterContract()],
  [INTERNET_ARCHIVE_ADAPTER_ID, createInternetArchiveAdapterContract()],
  [DPLA_V2_ADAPTER_ID, createDplaV2AdapterContract()],
];

for (const [adapterId, contract] of CONTRACTS) {
  test(`${adapterId}: disabled/unapproved entries cannot run (fail-closed)`, () => {
    const disabled = entryFor(contract, adapterId, 'disabled');
    assert.equal(canAdapterRun(disabled), false);
    assert.throws(() => assertAdapterMayRun(disabled), /cannot run in registry state "disabled"/);
  });

  test(`${adapterId}: canary state samples only a fraction of records via canarySampleFraction`, () => {
    const canaryEntry = entryFor(contract, adapterId, 'canary');
    assert.equal(canAdapterRun(canaryEntry), true);
    assert.equal(isCanaryMode(canaryEntry), true);
    assert.doesNotThrow(() => assertAdapterMayRun(canaryEntry));

    const sampleFraction = contract.canarySampleFraction;
    assert.ok(sampleFraction !== undefined && sampleFraction > 0 && sampleFraction <= 1);
    const indices = selectCanaryRecordIndices(200, sampleFraction!);
    assert.ok(indices.length > 0);
    assert.ok(indices.length < 200);
  });

  test(`${adapterId}: a record-count drift beyond the contract's tolerance quarantines the run`, () => {
    const { expectedRecordsPerRun, countToleranceFraction } = contract.volume;
    const health = evaluateRunHealth({
      expectedCount: expectedRecordsPerRun,
      actualCount: 0,
      countToleranceFraction,
      expectedSchemaVersion: contract.expectedSchemaVersion,
      observedSchemaVersion: contract.expectedSchemaVersion,
    });
    assert.equal(shouldQuarantineRun(health), true);
    assert.ok(health.issues.includes('record_count_drift'));
  });

  test(`${adapterId}: a schema-version drift also quarantines, and repeated quarantine dead-letters`, () => {
    const health = evaluateRunHealth({
      expectedCount: contract.volume.expectedRecordsPerRun,
      actualCount: contract.volume.expectedRecordsPerRun,
      countToleranceFraction: contract.volume.countToleranceFraction,
      expectedSchemaVersion: contract.expectedSchemaVersion,
      observedSchemaVersion: 'some-unexpected-schema.v99',
    });
    assert.equal(shouldQuarantineRun(health), true);
    assert.equal(shouldDeadLetterRun(3, 3), true);
    assert.equal(shouldDeadLetterRun(2, 3), false);
  });

  test(`${adapterId}: an approved (non-canary) entry with a healthy run may run without restriction`, () => {
    const approved = entryFor(contract, adapterId, 'approved');
    assert.equal(canAdapterRun(approved), true);
    assert.equal(isCanaryMode(approved), false);
    assert.doesNotThrow(() => assertAdapterMayRun(approved));
  });

  test(`${adapterId}: an engaged kill switch blocks the run even when approved`, () => {
    const approved = entryFor(contract, adapterId, 'approved');
    assert.throws(
      () => assertAdapterMayRun(approved, { id: `adapter:${adapterId}`, enabled: true }),
      /disabled and cannot create candidates/,
    );
    assert.doesNotThrow(() => assertAdapterMayRun(approved, { id: `adapter:${adapterId}`, enabled: false }));
  });
}
