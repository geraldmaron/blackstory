/**
 * Tests for the NRHP Multiple Property Listing (African American curated-net) adapter.
 * Fixture-driven only — no live NPS requests and no bulk OCR paths.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  type SourceRegistryEntry,
} from '../index.js';
import {
  createNrhpMplAdapterContract,
  createNrhpMplEvidenceSource,
  NRHP_MPL_ADAPTER_ID,
  NRHP_MPL_AA_CURATED_THEMES,
  NRHP_MPL_REGISTRY_ENTRY_ID,
  NRHP_MPL_RIGHTS,
  parseNrhpMplFixtureBatch,
  qualifiesForAaCuratedNet,
  registerNrhpMplAdapter,
} from './index.js';

const FIXED_NOW = '2026-07-21T17:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as unknown;
}

function approvedRegistryEntry(): SourceRegistryEntry {
  const store = createInMemorySourceRegistry();
  registerNrhpMplAdapter({ store, createdAt: FIXED_NOW });
  return approveSourcePolicy(store, {
    id: NRHP_MPL_REGISTRY_ENTRY_ID,
    approvedBy: 'admin@blackbook.local',
    approvedAt: FIXED_NOW,
  });
}

test('NRHP MPL adapter registers disabled by default and exposes public-domain rights', () => {
  const store = createInMemorySourceRegistry();
  const entry = registerNrhpMplAdapter({ store, createdAt: FIXED_NOW });
  assert.equal(entry.registryState, 'disabled');
  assert.equal(entry.contract.adapterId, NRHP_MPL_ADAPTER_ID);
  assert.equal(entry.contract.rights.defaultStatus, 'public_domain');
  assert.equal(entry.evidenceSource.killSwitchId, `adapter:${NRHP_MPL_ADAPTER_ID}`);
});

test('NRHP MPL adapter id is distinct from the federal NPS NRHP listing adapter id', async () => {
  const federal = await import('../federal/index.js');
  assert.notEqual(NRHP_MPL_ADAPTER_ID, federal.NPS_ADAPTER_ID);
});

test('AA curated-net gate accepts allowlisted themes with primary or significant relevance', () => {
  for (const theme of NRHP_MPL_AA_CURATED_THEMES.slice(0, 3)) {
    assert.equal(
      qualifiesForAaCuratedNet({ theme, aaHeritageRelevance: 'primary' }),
      true,
      theme,
    );
  }
  assert.equal(
    qualifiesForAaCuratedNet({
      theme: 'general_industrial_resources',
      aaHeritageRelevance: 'primary',
    }),
    false,
  );
  assert.equal(
    qualifiesForAaCuratedNet({
      theme: 'civil_rights_movement',
      aaHeritageRelevance: 'incidental',
    }),
    false,
  );
});

test('NRHP MPL normalizer parses fixture inventory with full provenance and strips forbidden keys', () => {
  const entry = approvedRegistryEntry();
  const raw = loadFixture('sample-mpl-inventory.json');
  const result = parseNrhpMplFixtureBatch(entry, 'run_nrhp_mpl_fixture', FIXED_NOW, raw);

  assert.equal(result.candidates.length, 3);
  assert.equal(result.rejected.length, 0);

  const first = result.candidates[0];
  assert.equal(first?.stableIdentifier, 'nrhp-mpl:64500901');
  assert.equal(first?.provenance.adapterId, NRHP_MPL_ADAPTER_ID);
  assert.equal(first?.provenance.registryEntryId, NRHP_MPL_REGISTRY_ENTRY_ID);
  assert.equal(first?.provenance.runId, 'run_nrhp_mpl_fixture');
  assert.equal(first?.provenance.sourceId, 'src_nrhp_mpl');
  assert.equal(first?.payload.theme, 'civil_rights_movement');
  assert.equal(first?.canonicalUrl?.includes('sample-mpl-64500901'), true);

  const stripped = result.candidates[2];
  assert.equal(stripped?.payload.strippedForbiddenKeys?.includes('pdfText'), true);
  assert.equal((stripped?.payload as Record<string, unknown>).pdfText, undefined);
});

test('NRHP MPL normalizer rejects records outside the AA curated-net', () => {
  const entry = approvedRegistryEntry();
  const result = parseNrhpMplFixtureBatch(entry, 'run_reject', FIXED_NOW, [
    {
      mplReference: '64500999',
      title: 'Historic Bridges of the Midwest',
      canonicalUrl: 'https://www.nps.gov/subjects/nationalregister/sample-mpl-64500999.htm',
      theme: 'historic_bridges',
      aaHeritageRelevance: 'primary',
    },
  ]);

  assert.equal(result.candidates.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0]?.reason, 'not_in_aa_curated_net');
});

test('NRHP MPL contract prohibits full-text republication consistent with no bulk OCR policy', () => {
  const contract = createNrhpMplAdapterContract();
  assert.equal(contract.rights.defaultStatus, NRHP_MPL_RIGHTS.defaultStatus);
  assert.equal(contract.rights.prohibitedUses.includes('full_text_republication'), true);
  assert.match(contract.policy.notes ?? '', /no bulk OCR/i);

  const evidenceSource = createNrhpMplEvidenceSource();
  assert.equal(evidenceSource.adapterId, NRHP_MPL_ADAPTER_ID);
});
