/**
 * Fail-closed validators for BB-058 seed campaigns. Calls real BB-090 notability gates,
 * BB-083 citation completeness gates, and BB-094 corpus promotion gates — never parallel
 * check logic that could drift from production gates.
 */
import { isCitationStructurallyComplete } from '../citations/citation.js';
import { assertClaimCitationComplete } from '../citations/completeness-gate.js';
import {
  assertPublishableEntityHasNotabilityBasis,
  evaluateNotabilityGate,
} from '../relevance/notability-gate.js';
import { hasRequiredNotabilityBasis } from '../entity-status.js';
import { createInMemorySourceRegistry } from '../adapters/registry.js';
import {
  assertCorpusVettedForBulkImport,
  createInMemoryCorpusVettingStore,
} from '../corpus-vetting.js';
import { registerLaunchCorpora } from '../launch-corpora.js';
import { evaluateCorpusBulkPromotion, type CorpusBulkRecordCandidate } from '../promotion/corpus-promotion.js';
import { assertKnownUsState } from './regions.js';
import { NATIONAL_SEED_MAX_RECORDS } from './bundle.js';
import { seedCampaignMeta } from './campaigns.js';
import {
  SEED_CAMPAIGN_IDS,
  US_CENSUS_REGIONS,
  type GeographicCoverageReport,
  type SeedCampaignId,
  type SeedRecord,
  type SeedValidationFailure,
  type SeedValidationResult,
  type UsCensusRegion,
} from './types.js';

export type SeedGateResult = {
  readonly recordId: string;
  readonly gate: string;
  readonly passed: boolean;
  readonly reason: string;
};

function failure(recordId: string, gate: string, reason: string): SeedValidationFailure {
  return { recordId, gate, reason };
}

/** Structural schema validation — fails closed on malformed fixture shape. */
export function assertSeedRecordSchemaValid(record: SeedRecord): void {
  if (!record.id.trim()) throw new Error('Seed record id is required');
  if (!(SEED_CAMPAIGN_IDS as readonly string[]).includes(record.campaignId)) {
    throw new Error(`Unknown campaignId: ${record.campaignId}`);
  }
  if (!record.displayName.trim()) throw new Error(`Seed record ${record.id}: displayName is required`);
  if (!['school', 'institution'].includes(record.kind)) {
    throw new Error(`Seed record ${record.id}: invalid kind`);
  }
  const region = assertKnownUsState(record.stateOrTerritory);
  if (record.censusRegion !== region) {
    throw new Error(
      `Seed record ${record.id}: censusRegion ${record.censusRegion} does not match state ${record.stateOrTerritory} (${region})`,
    );
  }
  if (record.citations.length === 0) {
    throw new Error(`Seed record ${record.id}: at least one citation is required`);
  }
  if (record.claims.length === 0) {
    throw new Error(`Seed record ${record.id}: at least one claim is required`);
  }
  if (!record.inclusionRationale.trim()) {
    throw new Error(`Seed record ${record.id}: inclusionRationale is required`);
  }
  if (!hasRequiredNotabilityBasis(record.notabilityBasis ? [record.notabilityBasis] : undefined)) {
    throw new Error(`Seed record ${record.id}: notabilityBasis is required`);
  }
}

/** BB-083 evidence gate — every claim must have a structurally complete citation. */
export function assertSeedRecordEvidenceGate(record: SeedRecord): void {
  for (const claim of record.claims) {
    const citations = record.citations.map((citation) => ({
      ...citation,
      claimId: claim.id,
      createdAt: citation.retrievalDate,
      updatedAt: citation.retrievalDate,
    }));
    assertClaimCitationComplete(claim, citations);
  }
  const anyComplete = record.citations.some((citation) => isCitationStructurallyComplete(citation));
  if (!anyComplete) {
    throw new Error(`Seed record ${record.id}: no structurally complete citation (BB-083 fail-closed).`);
  }
}

/** BB-090 notability gate — publishable entities require >=1 notability basis record. */
export function assertSeedRecordNotabilityGate(record: SeedRecord): void {
  const gate = evaluateNotabilityGate(record.notabilityBasis ? [record.notabilityBasis] : undefined);
  if (!gate.passed) {
    throw new Error(`Seed record ${record.id}: ${gate.reason}`);
  }
  assertPublishableEntityHasNotabilityBasis({
    id: record.id,
    ...(record.notabilityBasis ? { notabilityBasis: [record.notabilityBasis] } : {}),
  });
}

/** Campaign thematic fit — notability criterion must match campaign preferences. */
export function assertSeedRecordCampaignThematicFit(record: SeedRecord): void {
  const meta = seedCampaignMeta(record.campaignId);
  if (!meta.preferredNotabilityCriteria.includes(record.notabilityBasis.criterion)) {
    throw new Error(
      `Seed record ${record.id}: notability criterion ${record.notabilityBasis.criterion} ` +
        `is not preferred for campaign ${record.campaignId}`,
    );
  }
}

/** BB-094 corpus promotion gate when a record declares a launch-corpus source. */
export function assertSeedRecordCorpusPromotionGate(
  record: SeedRecord,
  input: { readonly vettedBy: string; readonly vettedAt: string },
): void {
  if (!record.sourceCorpus) return;

  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  registerLaunchCorpora(registryStore, vettingStore, input);

  const { vetting } = assertCorpusVettedForBulkImport(registryStore, vettingStore, record.sourceCorpus);

  const candidate: CorpusBulkRecordCandidate = {
    corpusId: record.sourceCorpus,
    batchId: 'seed-campaign-validation',
    sourceRecordId: record.id,
    title: record.displayName,
    citations: record.citations.map(({ sourceName, location, capture, retrievalDate }) => ({
      sourceName,
      location,
      capture,
      retrievalDate,
    })),
    documentedGeoPrecisionTier: record.documentedGeoPrecisionTier,
    geometryType: 'Point',
  };

  const promotion = evaluateCorpusBulkPromotion({
    vetting,
    candidate,
    spotCheckSelected: true,
    spotCheckVerdict: 'pass',
    evidenceIds: record.notabilityBasis.evidenceIds,
  });

  if (promotion.lane !== 'corpus_fast_track') {
    throw new Error(
      `Seed record ${record.id}: corpus promotion demoted to ${promotion.lane} — ${promotion.reasons.join(', ')}`,
    );
  }
}

/** Runs all seed gates for one record; returns gate results rather than throwing. */
export function evaluateSeedRecordGates(
  record: SeedRecord,
  input: { readonly vettedBy: string; readonly vettedAt: string },
): readonly SeedGateResult[] {
  const results: SeedGateResult[] = [];

  const run = (gate: string, fn: () => void) => {
    try {
      fn();
      results.push({ recordId: record.id, gate, passed: true, reason: 'passed' });
    } catch (error) {
      results.push({
        recordId: record.id,
        gate,
        passed: false,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  };

  run('schema', () => assertSeedRecordSchemaValid(record));
  run('evidence', () => assertSeedRecordEvidenceGate(record));
  run('notability', () => assertSeedRecordNotabilityGate(record));
  run('thematic_fit', () => assertSeedRecordCampaignThematicFit(record));
  run('corpus_promotion', () => assertSeedRecordCorpusPromotionGate(record, input));

  return Object.freeze(results);
}

/** Fail-closed: every record must pass every gate. */
export function assertAllSeedRecordsPassGates(
  records: readonly SeedRecord[],
  input: { readonly vettedBy: string; readonly vettedAt: string },
): void {
  const failures: SeedValidationFailure[] = [];
  for (const record of records) {
    for (const result of evaluateSeedRecordGates(record, input)) {
      if (!result.passed) {
        failures.push(failure(record.id, result.gate, result.reason));
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `Seed campaign validation failed (${failures.length} gate failure(s)): ` +
        failures.map((entry) => `${entry.recordId}/${entry.gate}`).join(', '),
    );
  }
}

/** BB-058 AC4 — seed must not approach bulk U.S. school inventory scale. */
export function assertNationalSeedNotBulkImport(records: readonly SeedRecord[]): void {
  if (records.length > NATIONAL_SEED_MAX_RECORDS) {
    throw new Error(
      `National seed has ${records.length} records, exceeding the quality-first cap of ` +
        `${NATIONAL_SEED_MAX_RECORDS} — this is not a bulk U.S. school import (BB-058 AC4).`,
    );
  }
}

export function computeGeographicCoverage(records: readonly SeedRecord[]): GeographicCoverageReport {
  const byRegion = Object.fromEntries(US_CENSUS_REGIONS.map((region) => [region, 0])) as Record<
    UsCensusRegion,
    number
  >;
  const byState: Record<string, number> = {};

  for (const record of records) {
    byRegion[record.censusRegion] += 1;
    byState[record.stateOrTerritory] = (byState[record.stateOrTerritory] ?? 0) + 1;
  }

  const representedRegions = US_CENSUS_REGIONS.filter((region) => byRegion[region] > 0);
  const missingRegions = US_CENSUS_REGIONS.filter((region) => byRegion[region] === 0);

  return Object.freeze({
    byRegion: Object.freeze(byRegion),
    byState: Object.freeze(byState),
    representedRegions: Object.freeze(representedRegions),
    missingRegions: Object.freeze(missingRegions),
  });
}

export function validateNationalSeedCampaign(input: {
  readonly records: readonly SeedRecord[];
  readonly vettedBy: string;
  readonly vettedAt: string;
}): SeedValidationResult {
  const failures: SeedValidationFailure[] = [];

  try {
    assertNationalSeedNotBulkImport(input.records);
  } catch (error) {
    failures.push(failure('*', 'bulk_cap', error instanceof Error ? error.message : String(error)));
  }

  const ids = new Set<string>();
  for (const record of input.records) {
    if (ids.has(record.id)) {
      failures.push(failure(record.id, 'unique_id', 'Duplicate seed record id'));
    }
    ids.add(record.id);

    for (const result of evaluateSeedRecordGates(record, input)) {
      if (!result.passed) {
        failures.push(failure(record.id, result.gate, result.reason));
      }
    }
  }

  if (failures.length > 0) {
    return Object.freeze({ ok: false, failures: Object.freeze(failures) });
  }

  const byCampaign = Object.fromEntries(
    SEED_CAMPAIGN_IDS.map((id) => [id, input.records.filter((record) => record.campaignId === id).length]),
  ) as Record<SeedCampaignId, number>;

  return Object.freeze({
    ok: true,
    recordCount: input.records.length,
    byCampaign: Object.freeze(byCampaign),
  });
}
