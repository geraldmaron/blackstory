/**
 * Tests proving the BB-091 Census TIGER/Gazetteer source is registered through the BB-037
 * registry with a public-domain license verdict (BB-091 acceptance criterion 7).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSourceAdapterContractValid } from '../contract.js';
import { createInMemorySourceRegistry, registerSource } from '../registry.js';
import {
  CENSUS_GEO_ADAPTER_ID,
  CENSUS_GEO_RIGHTS,
  createCensusGeoAdapterContract,
  createCensusGeoEvidenceSource,
} from './contract.js';

test('createCensusGeoAdapterContract produces a structurally valid BB-037 contract', () => {
  const contract = createCensusGeoAdapterContract();
  assert.doesNotThrow(() => assertSourceAdapterContractValid(contract));
  assert.equal(contract.adapterId, CENSUS_GEO_ADAPTER_ID);
  assert.equal(contract.geographicCoverage.countries[0], 'US');
});

test('Census TIGER/Gazetteer carries a public_domain rights verdict — no paid geo API', () => {
  const contract = createCensusGeoAdapterContract();
  assert.equal(contract.rights.defaultStatus, 'public_domain');
  assert.equal(CENSUS_GEO_RIGHTS.defaultStatus, 'public_domain');
  // A public-domain U.S. Government Work has no prohibited-use restriction.
  assert.deepEqual(contract.rights.prohibitedUses, []);
});

test('the Census source registers cleanly through the BB-037 in-memory registry', () => {
  const store = createInMemorySourceRegistry();
  const contract = createCensusGeoAdapterContract();
  const evidenceSource = {
    ...createCensusGeoEvidenceSource(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const entry = registerSource(store, {
    id: 'reg_census_geo',
    contract,
    evidenceSource,
    registryState: 'approved',
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(entry.registryState, 'approved');
  assert.equal(entry.evidenceSource.adapterId, contract.adapterId);
  assert.equal(store.get('reg_census_geo')?.contract.rights.defaultStatus, 'public_domain');
});

test('createCensusGeoEvidenceSource.adapterId matches the contract adapterId', () => {
  const contract = createCensusGeoAdapterContract();
  const evidenceSource = createCensusGeoEvidenceSource();
  assert.equal(evidenceSource.adapterId, contract.adapterId);
  assert.equal(evidenceSource.classification, contract.classification);
});
