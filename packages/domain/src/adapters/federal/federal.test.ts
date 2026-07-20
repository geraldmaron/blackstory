/**
 * Federal archive adapter tests: per-source fixtures, retention, export filtering, failure isolation.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  registerSource,
  type SourceRegistryEntry,
} from '../index.js';
import {
  buildIsolatedFederalRunResult,
  DPLA_ADAPTER_ID,
  FEDERAL_ADAPTER_DEFINITIONS,
  FEDERAL_ADAPTER_KILL_SWITCH_PREFIX,
  federalAdapterKillSwitchId,
  filterLargeExportPayload,
  getFederalAdapterDefinition,
  LOC_ADAPTER_ID,
  locAdapterDefinition,
  naraAdapterDefinition,
  NARA_ADAPTER_ID,
  npsAdapterDefinition,
  parseFederalFixtureBatch,
  parseFederalAdapterKillSwitchId,
  qualifiesForCandidateRetention,
  schoolHistoryAdapterDefinition,
} from './index.js';

const FIXED_NOW = '2026-07-16T20:00:00.000Z';
const FEDERAL_DIR = dirname(fileURLToPath(import.meta.url));

function loadFixture(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(FEDERAL_DIR, relativePath), 'utf8')) as unknown;
}

function approvedRegistryEntry(definition: typeof locAdapterDefinition): SourceRegistryEntry {
  const store = createInMemorySourceRegistry();
  registerSource(store, {
    id: `reg_${definition.family}`,
    contract: definition.contract,
    evidenceSource: {
      ...definition.evidenceSource,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    createdAt: FIXED_NOW,
  });
  return approveSourcePolicy(store, {
    id: `reg_${definition.family}`,
    approvedBy: 'admin@blackbook.local',
    approvedAt: FIXED_NOW,
  });
}

test('federal adapters expose independent contracts, rights, rate limits, and kill switches', () => {
  assert.equal(FEDERAL_ADAPTER_DEFINITIONS.length, 5);
  const ids = new Set(FEDERAL_ADAPTER_DEFINITIONS.map((definition) => definition.adapterId));
  assert.equal(ids.size, 5);

  for (const definition of FEDERAL_ADAPTER_DEFINITIONS) {
    assert.ok(definition.contract.rateLimits.requestsPerMinute > 0);
    assert.ok(definition.rights.publicationPermissions.length > 0);
    assert.ok(definition.killSwitchId.startsWith(FEDERAL_ADAPTER_KILL_SWITCH_PREFIX));
    assert.equal(definition.killSwitchId, federalAdapterKillSwitchId(definition.adapterId));
    assert.equal(parseFederalAdapterKillSwitchId(definition.killSwitchId), definition.adapterId);
  }
});

test('Library of Congress adapter parses fixture and rejects non-qualifying records', () => {
  const entry = approvedRegistryEntry(locAdapterDefinition);
  const raw = loadFixture('loc/fixtures/sample-export.json');
  const result = parseFederalFixtureBatch(locAdapterDefinition, entry, 'run_loc', FIXED_NOW, raw);

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.stableIdentifier, 'lccn-2016656001');
  assert.equal(result.rejected.length, 1);
  assert.equal(getFederalAdapterDefinition(LOC_ADAPTER_ID)?.family, 'loc');
});

test('National Archives adapter strips large export fields from payload', () => {
  const entry = approvedRegistryEntry(naraAdapterDefinition);
  const raw = loadFixture('nara/fixtures/sample-export.json');
  const result = parseFederalFixtureBatch(naraAdapterDefinition, entry, 'run_nara', FIXED_NOW, raw);

  assert.equal(result.candidates.length, 1);
  assert.equal(result.filteredExportCount, 1);
  assert.equal(result.candidates[0]?.payload?.fullText, undefined);
  assert.equal(result.candidates[0]?.payload?.recordGroup, 'RG-123');
  assert.equal(
    result.rejected.some((record) => record.reason === 'missing_canonical_url'),
    true,
  );
});

test('DPLA adapter retains only qualifying metadata under export filter policy', () => {
  const definition = getFederalAdapterDefinition(DPLA_ADAPTER_ID)!;
  const filtered = filterLargeExportPayload(
    {
      stableIdentifier: 'dpla-x',
      title: 'Sample',
      canonicalUrl: 'https://dp.la/item/x',
      aggregatedPreview: 'x'.repeat(10_000),
      provider: 'Test',
    },
    definition.exportFilter,
  );
  assert.equal(filtered.filtered, true);
  assert.equal(filtered.payload.aggregatedPreview, undefined);
  assert.equal(filtered.payload.provider, 'Test');
});

test('NPS National Register adapter parses fixture with geo bulk stripped', () => {
  const entry = approvedRegistryEntry(npsAdapterDefinition);
  const raw = loadFixture('nps/fixtures/sample-export.json');
  const result = parseFederalFixtureBatch(npsAdapterDefinition, entry, 'run_nps', FIXED_NOW, raw);

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.payload?.boundaryGeojson, undefined);
  assert.equal(result.candidates[0]?.payload?.nrhpReference, '66000001');
});

test('school-history adapter enforces curriculum tier retention rules', () => {
  const entry = approvedRegistryEntry(schoolHistoryAdapterDefinition);
  const raw = loadFixture('school-history/fixtures/sample-export.json');
  const result = parseFederalFixtureBatch(
    schoolHistoryAdapterDefinition,
    entry,
    'run_school',
    FIXED_NOW,
    raw,
  );

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.payload?.lessonPlanBody, undefined);
  assert.equal(
    result.rejected.some((record) => record.reason.startsWith('missing_required_field')),
    true,
  );
});

test('retention gate rejects records missing required canonical URL', () => {
  const gate = qualifiesForCandidateRetention(
    { stableIdentifier: 'x', title: 'Valid title', classification: 'primary_archival' },
    naraAdapterDefinition.retention,
  );
  assert.equal(gate.qualified, false);
  if (!gate.qualified) {
    assert.equal(gate.reason, 'missing_canonical_url');
  }
});

test('adapter failure isolation quarantines drift without publication impact', () => {
  const entry = approvedRegistryEntry(naraAdapterDefinition);
  const raw = loadFixture('nara/fixtures/sample-export.json');
  const parseResult = parseFederalFixtureBatch(
    naraAdapterDefinition,
    entry,
    'run_isolation',
    FIXED_NOW,
    raw,
  );

  const isolated = buildIsolatedFederalRunResult({
    context: {
      runId: 'run_isolation',
      startedAt: FIXED_NOW,
      registryEntry: entry,
    },
    parseResult,
    completedAt: FIXED_NOW,
  });

  assert.equal(isolated.publicationImpact, 'none');
  assert.equal(isolated.outcome, 'quarantined');
  assert.equal(isolated.candidates.length, 0);
  assert.ok(isolated.issues.some((issue) => issue.includes('Record count drift')));
});

test('adapter runtime errors dead-letter without publication impact', () => {
  const entry = approvedRegistryEntry(locAdapterDefinition);
  const isolated = buildIsolatedFederalRunResult({
    context: {
      runId: 'run_error',
      startedAt: FIXED_NOW,
      registryEntry: entry,
    },
    error: new Error('fixture parser exploded'),
    completedAt: FIXED_NOW,
  });

  assert.equal(isolated.outcome, 'dead_letter');
  assert.equal(isolated.publicationImpact, 'none');
  assert.equal(isolated.candidateCount, 0);
  assert.ok(isolated.issues[0]?.includes('fixture parser exploded'));
});

test('NARA adapter id remains stable for cross-bead registry compatibility', () => {
  assert.equal(NARA_ADAPTER_ID, 'nara-catalog-v1');
  assert.equal(naraAdapterDefinition.killSwitchId, federalAdapterKillSwitchId('nara-catalog-v1'));
});
