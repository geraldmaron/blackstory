/**
 * Tests for legal source adapters fixture-only, no live network.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSourceAdapterContractValid } from '../contract.js';
import {
  createCongressGovAdapterContract,
  createCourtListenerAdapterContract,
  createEcfrAdapterContract,
  createLegiScanAdapterContract,
  parseAllLegalFixtures,
  parseCongressGovFixtures,
  parseCourtListenerFixtures,
  validateCaseCitationInFixtures,
} from './index.js';
import { assertLegalSnapshotValid } from '../../legal/types.js';

test('legal adapter contracts pass BB-037 validation', () => {
  assert.doesNotThrow(() => assertSourceAdapterContractValid(createCongressGovAdapterContract()));
  assert.doesNotThrow(() => assertSourceAdapterContractValid(createEcfrAdapterContract()));
  assert.doesNotThrow(() => assertSourceAdapterContractValid(createCourtListenerAdapterContract()));
  assert.doesNotThrow(() => assertSourceAdapterContractValid(createLegiScanAdapterContract()));
});

test('Congress.gov fixture parser returns valid snapshots', () => {
  const result = parseCongressGovFixtures();
  assert.ok(result.snapshots.length >= 2);
  for (const snapshot of result.snapshots) {
    assert.doesNotThrow(() => assertLegalSnapshotValid(snapshot));
  }
  assert.equal(result.monitoringRows.length, result.snapshots.length);
});

test('CourtListener citation lookup validates against fixture corpus', () => {
  assert.equal(validateCaseCitationInFixtures('347 U.S. 483'), true);
  assert.equal(validateCaseCitationInFixtures('999 U.S. 999'), false);
});

test('parseAllLegalFixtures aggregates every adapter without network', () => {
  const results = parseAllLegalFixtures();
  assert.equal(results.length, 4);
  const totalSnapshots = results.reduce((sum, r) => sum + r.snapshots.length, 0);
  assert.ok(totalSnapshots >= 5);
});

test('CourtListener fixture includes Brown and Shelby County', () => {
  const { snapshots } = parseCourtListenerFixtures();
  const titles = snapshots.map((s) => s.title);
  assert.ok(titles.some((t) => t.includes('Brown')));
  assert.ok(titles.some((t) => t.includes('Shelby')));
});
