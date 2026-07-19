/**
 * Corpus vetting record model + storage: one auditable vetting record per bulk-import corpus,
 * registered through the source registry.
 *
 * "Vet once, import bulk": rather than re-litigating licensing, custodianship,
 * and authority for every record a settled corpus (National Register, HABS/HAER,...)
 * contributes, the corpus itself is vetted ONCE and the verdict recorded here
 * (`CorpusVettingRecord`). Bulk batches then run exclusively through the existing
 * CLI/quarantine pipeline (`packages/operator-cli/src/bulk-import.ts`), gated by
 * `assertCorpusVettedForBulkImport` below an unvetted corpus, a corpus whose license verdict
 * was never cleared for bulk import, or a corpus whose registry entry is
 * disabled/quarantined/dead-lettered/kill-switched all fail closed before a single record is
 * imported.
 *
 * Registration deliberately reuses the real registry (`./adapters/registry.js`,
 * `./adapters/gates.js`) instead of inventing a parallel enable/disable/kill-switch mechanism:
 * each vetted corpus becomes its own `SourceRegistryEntry` (adapterId `bulk-corpus:<corpus>`),
 * and clearing a corpus for import calls the existing `approveSourcePolicy` — the same
 * `registryState` `approvedAt` `approvedBy` kill-switch fail-closed gate already
 * built and tested (`assertAdapterMayRun`) is reused verbatim here, not re-implemented. Corpora
 * whose `licenseVerdict` is not cleared (e.g. `deferred-unverified`) are registered but never
 * approved, so `assertAdapterMayRun` fails closed on them automatically no separate check
 * could accidentally diverge from the registry's own state.
 *
 * These are dedicated, -owned registry entries distinct from any live discovery adapter
 * e.g. the federal adapter `nps-national-register-v1` also touches NPS data, but for a
 * different, continuously-polled discovery workload with its own volume/canary expectations.
 * corpus registry entries never mutate or depend on another team's adapter state.
 */
import {
  approveSourcePolicy,
  registerSource,
  setRegistryState,
  type SourceRegistryStore,
} from './adapters/registry.js';
import { assertAdapterMayRun, canAdapterRun } from './adapters/gates.js';
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from './adapters/candidates.js';
import type { RateLimitPolicy, SourceAdapterContract, SourceRegistryEntry } from './adapters/types.js';
import type { EvidenceSource, SourceKillSwitchState } from './provenance/source.js';
import type { RightsPolicy } from './provenance/rights.js';
import { GEO_PRECISION_TIERS, type GeoPrecisionTier } from './geography/precision.js';
import { NOTABILITY_CRITERIA, type NotabilityCriterion } from './entity-status.js';

// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------

/**
 * License clearance verdict for a corpus. `deferred-unverified` and `rejected` are recorded
 * (never silently omitted) but are NOT eligible for bulk import see
 * `isBulkImportEligibleLicenseVerdict`.
 */
export const LICENSE_VERDICTS = [
  'public-domain',
  'permissive-license',
  'restricted-attribution-required',
  'deferred-unverified',
  'rejected',
] as const;

export type LicenseVerdict = (typeof LICENSE_VERDICTS)[number];

export function isLicenseVerdict(value: string): value is LicenseVerdict {
  return (LICENSE_VERDICTS as readonly string[]).includes(value);
}

/** Verdicts cleared for bulk import; everything else fails closed. */
export const BULK_IMPORT_ELIGIBLE_LICENSE_VERDICTS: readonly LicenseVerdict[] = [
  'public-domain',
  'permissive-license',
  'restricted-attribution-required',
];

export function isBulkImportEligibleLicenseVerdict(verdict: LicenseVerdict): boolean {
  return (BULK_IMPORT_ELIGIBLE_LICENSE_VERDICTS as readonly string[]).includes(verdict);
}

/** Custodian authority tier a corpus-level analog of source reputation, deliberately kept
 * distinct from `promotion/model.ts`'s `SourceReputation` (that vocabulary evaluates individual
 * evidence items across independent lineages; a corpus custodian isn't a lineage). */
export const CORPUS_AUTHORITY_TIERS = [
  'federal_government',
  'state_or_local_government',
  'academic_institution',
  'established_nonprofit',
  'community_or_crowd_sourced',
] as const;

export type CorpusAuthorityTier = (typeof CORPUS_AUTHORITY_TIERS)[number];

export function isCorpusAuthorityTier(value: string): value is CorpusAuthorityTier {
  return (CORPUS_AUTHORITY_TIERS as readonly string[]).includes(value);
}

export const REFRESH_CADENCES = ['static', 'ad_hoc', 'weekly', 'monthly', 'quarterly', 'annual'] as const;

export type RefreshCadence = (typeof REFRESH_CADENCES)[number];

export function isRefreshCadence(value: string): value is RefreshCadence {
  return (REFRESH_CADENCES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Boundary rules
// ---------------------------------------------------------------------------

/**
 * Corpora that belong to another team's lane and must never be registered here. Statutes/cases
 * are legal corpus; Tougaloo sundown-town data is exclusion-infrastructure
 * layer. Both patterns are checked case-insensitively against the corpus slug so a differently
 * cased or hyphenated attempt still fails closed.
 */
export const EXCLUDED_CORPUS_LANES: readonly {
  readonly corpusSlugPattern: RegExp;
  readonly ownerBead: string;
  readonly reason: string;
}[] = [
  {
    corpusSlugPattern: /^(statutes?|cases?|legal[-_]?corpus)$/iu,
    ownerBead: '',
    reason: 'Statutes and cases are \'s legal corpus lane, never the  bulk-intake lane.',
  },
  {
    corpusSlugPattern: /^tougaloo([-_]sundown([-_]data)?)?$/iu,
    ownerBead: '',
    reason:
      'Tougaloo sundown-town data is \'s exclusion-infrastructure lane, never the  bulk-intake lane.',
  },
];

/** Fails closed when a corpus slug matches a lane reserved for another. */
export function assertCorpusNotInExcludedLane(corpus: string): void {
  const match = EXCLUDED_CORPUS_LANES.find((exclusion) => exclusion.corpusSlugPattern.test(corpus));
  if (match) {
    throw new Error(
      `Corpus "${corpus}" belongs to ${match.ownerBead}'s lane, not 's bulk-intake lane: ${match.reason}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Corpus vetting record
// ---------------------------------------------------------------------------

/**
 * One vetting record per corpus:
 * `{corpus, custodian, licenseVerdict, authorityTier, provenanceFieldsRetained,
 * precisionExpectation, refreshCadence, vettedBy, vettedAt}`, plus the linkage back to its
 * registry entry and the notability criterion its corpus membership auto-derives.
 */
export type CorpusVettingRecord = {
  /** Stable corpus slug, e.g. "nrhp". Also the registry adapter suffix (`bulk-corpus:<corpus>`). */
  readonly corpus: string;
  readonly corpusDisplayName: string;
  readonly custodian: string;
  readonly licenseVerdict: LicenseVerdict;
  readonly licenseNotes: string;
  readonly authorityTier: CorpusAuthorityTier;
  /** Provenance fields retained per record never fewer than the source documents. */
  readonly provenanceFieldsRetained: readonly string[];
  /** Best-documented geoPrecision tier this corpus's records are expected at. */
  readonly precisionExpectation: GeoPrecisionTier;
  /** True only for corpora whose records carry real polygon geometry (e.g. Mapping Inequality
   * ), never point+radius. */
  readonly requiresPolygonGeometry: boolean;
  readonly refreshCadence: RefreshCadence;
  readonly vettedBy: string;
  readonly vettedAt: string;
  /** registry entry id this vetting record is registered through. */
  readonly sourceRegistryEntryId: string;
  /** notability criterion corpus membership in this corpus auto-derives per record. */
  readonly notabilityCriterion: NotabilityCriterion;
  readonly citationRequirements?: string;
  readonly boundaryNotes?: string;
};

export function assertCorpusVettingRecordValid(record: CorpusVettingRecord): void {
  if (!record.corpus.trim()) throw new Error('corpus is required');
  assertCorpusNotInExcludedLane(record.corpus);
  if (!record.corpusDisplayName.trim()) throw new Error('corpusDisplayName is required');
  if (!record.custodian.trim()) throw new Error('custodian is required');
  if (!isLicenseVerdict(record.licenseVerdict)) {
    throw new Error(`Unknown licenseVerdict: ${record.licenseVerdict}`);
  }
  if (!record.licenseNotes.trim()) throw new Error('licenseNotes is required (even for deferred verdicts)');
  if (!isCorpusAuthorityTier(record.authorityTier)) {
    throw new Error(`Unknown authorityTier: ${record.authorityTier}`);
  }
  if (record.provenanceFieldsRetained.length === 0) {
    throw new Error('provenanceFieldsRetained must be non-empty');
  }
  if (!(GEO_PRECISION_TIERS as readonly string[]).includes(record.precisionExpectation)) {
    throw new Error(`Unknown precisionExpectation: ${record.precisionExpectation}`);
  }
  if (!isRefreshCadence(record.refreshCadence)) {
    throw new Error(`Unknown refreshCadence: ${record.refreshCadence}`);
  }
  if (!record.vettedBy.trim()) throw new Error('vettedBy is required');
  if (!Number.isFinite(Date.parse(record.vettedAt))) throw new Error('vettedAt must be an ISO date');
  if (!record.sourceRegistryEntryId.trim()) throw new Error('sourceRegistryEntryId is required');
  if (!(NOTABILITY_CRITERIA as readonly string[]).includes(record.notabilityCriterion)) {
    throw new Error(`Unknown notabilityCriterion: ${record.notabilityCriterion}`);
  }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** Persistence boundary for corpus vetting records (Firestore adapter is a later, same
 * shape as `./adapters/registry.js`'s `SourceRegistryStore`). */
export type CorpusVettingStore = {
  get(corpus: string): CorpusVettingRecord | undefined;
  list(): readonly CorpusVettingRecord[];
  save(record: CorpusVettingRecord): void;
};

export function createInMemoryCorpusVettingStore(
  seed: readonly CorpusVettingRecord[] = [],
): CorpusVettingStore {
  const records = new Map<string, CorpusVettingRecord>(seed.map((record) => [record.corpus, record]));
  return {
    get(corpus: string) {
      return records.get(corpus);
    },
    list() {
      return [...records.values()].sort((a, b) => a.corpus.localeCompare(b.corpus));
    },
    save(record: CorpusVettingRecord) {
      records.set(record.corpus, record);
    },
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function corpusSourceRegistryEntryId(corpus: string): string {
  return `corpus_registry:${corpus}`;
}

export function corpusAdapterId(corpus: string): string {
  return `bulk-corpus:${corpus}`;
}

export type RegisterCorpusVettingInput = {
  readonly corpus: string;
  readonly corpusDisplayName: string;
  readonly custodian: string;
  readonly licenseVerdict: LicenseVerdict;
  readonly licenseNotes: string;
  readonly authorityTier: CorpusAuthorityTier;
  readonly provenanceFieldsRetained: readonly string[];
  readonly precisionExpectation: GeoPrecisionTier;
  readonly requiresPolygonGeometry?: boolean;
  readonly refreshCadence: RefreshCadence;
  readonly vettedBy: string;
  readonly vettedAt: string;
  readonly notabilityCriterion: NotabilityCriterion;
  readonly citationRequirements?: string;
  readonly boundaryNotes?: string;
  /** `sourceClassifications` token, e.g. "government_record". */
  readonly classification: string;
  readonly rights: RightsPolicy;
  readonly permittedClaimClasses: readonly string[];
  readonly stableIdScheme: string;
  readonly organizationId: string;
  readonly rateLimits?: RateLimitPolicy;
  readonly expectedRecordsPerRun?: number;
  readonly geographicCoverageCountries?: readonly string[];
};

/**
 * Registers (or re-registers) a corpus vetting record and its backing registry entry in
 * one step. Approves the registry entry immediately IFF the license verdict is bulk-import
 * eligible; otherwise the entry stays `disabled` so `assertCorpusVettedForBulkImport` fails
 * closed without any parallel check that could drift from the registry's own state.
 */
export function registerCorpusVetting(
  registryStore: SourceRegistryStore,
  vettingStore: CorpusVettingStore,
  input: RegisterCorpusVettingInput,
): CorpusVettingRecord {
  assertCorpusNotInExcludedLane(input.corpus);

  const adapterId = corpusAdapterId(input.corpus);
  const registryEntryId = corpusSourceRegistryEntryId(input.corpus);
  const policy = {
    snapshotMode: 'selective' as const,
    rights: input.rights,
    permittedClaimClasses: input.permittedClaimClasses,
    refreshSchedule: input.refreshCadence,
    notes: ` vetted bulk-import corpus "${input.corpus}"; custodian: ${input.custodian}.`,
  };

  const contract: SourceAdapterContract = {
    adapterId,
    parserVersion: 'bulk-import-v1',
    displayName: input.corpusDisplayName,
    classification: input.classification,
    stableIdScheme: input.stableIdScheme,
    policy,
    rights: input.rights,
    permittedClaimClasses: input.permittedClaimClasses,
    refreshSchedule: input.refreshCadence,
    rateLimits: input.rateLimits ?? { requestsPerMinute: 1 },
    volume: {
      expectedRecordsPerRun: input.expectedRecordsPerRun ?? 0,
      countToleranceFraction: 1,
    },
    geographicCoverage: { countries: [...(input.geographicCoverageCountries ?? ['US'])] },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
  };

  const evidenceSource: Omit<EvidenceSource, 'createdAt' | 'updatedAt'> = {
    id: registryEntryId,
    organizationId: input.organizationId,
    displayName: input.corpusDisplayName,
    classification: input.classification,
    adapterId,
    stableIdScheme: input.stableIdScheme,
    policy,
    adapterEnabled: true,
    killSwitchId: corpusBulkImportKillSwitchId(input.corpus),
  };

  registerSource(registryStore, {
    id: registryEntryId,
    contract,
    evidenceSource: { ...evidenceSource, createdAt: input.vettedAt, updatedAt: input.vettedAt },
    createdAt: input.vettedAt,
  });

  if (isBulkImportEligibleLicenseVerdict(input.licenseVerdict)) {
    approveSourcePolicy(registryStore, {
      id: registryEntryId,
      approvedBy: input.vettedBy,
      approvedAt: input.vettedAt,
    });
  }

  const record: CorpusVettingRecord = {
    corpus: input.corpus,
    corpusDisplayName: input.corpusDisplayName,
    custodian: input.custodian,
    licenseVerdict: input.licenseVerdict,
    licenseNotes: input.licenseNotes,
    authorityTier: input.authorityTier,
    provenanceFieldsRetained: input.provenanceFieldsRetained,
    precisionExpectation: input.precisionExpectation,
    requiresPolygonGeometry: input.requiresPolygonGeometry ?? false,
    refreshCadence: input.refreshCadence,
    vettedBy: input.vettedBy,
    vettedAt: input.vettedAt,
    sourceRegistryEntryId: registryEntryId,
    notabilityCriterion: input.notabilityCriterion,
    ...(input.citationRequirements ? { citationRequirements: input.citationRequirements } : {}),
    ...(input.boundaryNotes ? { boundaryNotes: input.boundaryNotes } : {}),
  };
  assertCorpusVettingRecordValid(record);
  vettingStore.save(record);
  return record;
}

/**
 * Explicitly blocks a previously-registered corpus (e.g. a license verdict is revoked, or the
 * kill switch needs to be engaged at the registry level). Mirrors `setRegistryState` no
 * separate disable path exists.
 */
export function quarantineCorpusRegistryEntry(
  registryStore: SourceRegistryStore,
  input: { readonly corpus: string; readonly reason: string; readonly updatedAt: string },
): SourceRegistryEntry {
  return setRegistryState(registryStore, {
    id: corpusSourceRegistryEntryId(input.corpus),
    registryState: 'quarantined',
    updatedAt: input.updatedAt,
    quarantineReason: input.reason,
  });
}

// ---------------------------------------------------------------------------
// Kill switch (pattern mirrors `./adapters/federal/shared/kill-switch.ts` and
// `./adapters/internet-archive/shared/kill-switch.ts`'s `adapter:<id>` convention exactly, with
// a `corpus-bulk-import:` sub-scope so kill switches can never collide with a live
// discovery adapter's kill switch id).
// ---------------------------------------------------------------------------

export const CORPUS_BULK_IMPORT_KILL_SWITCH_PREFIX = 'adapter:corpus-bulk-import:' as const;

export function corpusBulkImportKillSwitchId(corpus: string): string {
  const trimmed = corpus.trim();
  if (!trimmed) throw new Error('corpus is required for kill-switch id');
  return `${CORPUS_BULK_IMPORT_KILL_SWITCH_PREFIX}${trimmed}`;
}

export function parseCorpusBulkImportKillSwitchId(killSwitchId: string): string | null {
  if (!killSwitchId.startsWith(CORPUS_BULK_IMPORT_KILL_SWITCH_PREFIX)) return null;
  const corpus = killSwitchId.slice(CORPUS_BULK_IMPORT_KILL_SWITCH_PREFIX.length).trim();
  return corpus || null;
}

// ---------------------------------------------------------------------------
// Budget caps
// ---------------------------------------------------------------------------

export type CorpusBulkImportBudget = {
  /** Hard per-call cap; a batch larger than this must be split by the caller. */
  readonly maxRecordsPerBatch: number;
  /** Optional rolling-window cap across multiple batches for the same corpus. */
  readonly maxRecordsPerRefreshWindow?: number;
};

export function assertCorpusBulkImportBudgetValid(budget: CorpusBulkImportBudget): void {
  if (!Number.isInteger(budget.maxRecordsPerBatch) || budget.maxRecordsPerBatch < 1) {
    throw new Error('maxRecordsPerBatch must be a positive integer');
  }
  if (
    budget.maxRecordsPerRefreshWindow !== undefined &&
    (!Number.isInteger(budget.maxRecordsPerRefreshWindow) ||
      budget.maxRecordsPerRefreshWindow < budget.maxRecordsPerBatch)
  ) {
    throw new Error('maxRecordsPerRefreshWindow must be an integer >= maxRecordsPerBatch when set');
  }
}

/** Fail-closed budget-cap gate. */
export function assertWithinCorpusBulkImportBudget(input: {
  readonly budget: CorpusBulkImportBudget;
  readonly batchRecordCount: number;
  readonly priorRecordsInWindow?: number;
}): void {
  assertCorpusBulkImportBudgetValid(input.budget);
  if (input.batchRecordCount > input.budget.maxRecordsPerBatch) {
    throw new Error(
      `Bulk import batch of ${input.batchRecordCount} records exceeds the per-batch budget cap ` +
        `of ${input.budget.maxRecordsPerBatch} ( fail-closed).`,
    );
  }
  if (
    input.budget.maxRecordsPerRefreshWindow !== undefined &&
    (input.priorRecordsInWindow ?? 0) + input.batchRecordCount > input.budget.maxRecordsPerRefreshWindow
  ) {
    throw new Error(
      `Bulk import batch would push corpus imports to ` +
        `${(input.priorRecordsInWindow ?? 0) + input.batchRecordCount}, exceeding the refresh-window ` +
        `budget cap of ${input.budget.maxRecordsPerRefreshWindow} ( fail-closed).`,
    );
  }
}

// ---------------------------------------------------------------------------
// The fail-closed gate
// ---------------------------------------------------------------------------

export type CorpusVettingGateResult = {
  readonly vetting: CorpusVettingRecord;
  readonly registryEntry: SourceRegistryEntry;
};

/**
 * Fail-closed gate: throws unless the corpus has a vetting record, that record's license verdict
 * is cleared for bulk import, and its backing registry entry may run (approved/canary
 * registry state, approved policy, kill switch not engaged) see `assertAdapterMayRun`.
 */
export function assertCorpusVettedForBulkImport(
  registryStore: SourceRegistryStore,
  vettingStore: CorpusVettingStore,
  corpus: string,
  killSwitch?: SourceKillSwitchState | null,
): CorpusVettingGateResult {
  const vetting = vettingStore.get(corpus);
  if (!vetting) {
    throw new Error(
      `Bulk import blocked: corpus "${corpus}" has no vetting record ( fail-closed).`,
    );
  }
  if (!isBulkImportEligibleLicenseVerdict(vetting.licenseVerdict)) {
    throw new Error(
      `Bulk import blocked: corpus "${corpus}" license verdict "${vetting.licenseVerdict}" is not ` +
        'cleared for bulk import ( fail-closed).',
    );
  }
  const registryEntry = registryStore.get(vetting.sourceRegistryEntryId);
  if (!registryEntry) {
    throw new Error(
      `Bulk import blocked: corpus "${corpus}" vetting record points at missing registry entry ` +
        `"${vetting.sourceRegistryEntryId}" ( fail-closed).`,
    );
  }
  assertAdapterMayRun(registryEntry, killSwitch);
  return { vetting, registryEntry };
}

/** Non-throwing variant for UI/report surfaces that want a boolean rather than a caught error. */
export function isCorpusVettedForBulkImport(
  registryStore: SourceRegistryStore,
  vettingStore: CorpusVettingStore,
  corpus: string,
  killSwitch?: SourceKillSwitchState | null,
): boolean {
  const vetting = vettingStore.get(corpus);
  if (!vetting || !isBulkImportEligibleLicenseVerdict(vetting.licenseVerdict)) return false;
  const registryEntry = registryStore.get(vetting.sourceRegistryEntryId);
  if (!registryEntry) return false;
  return canAdapterRun(registryEntry, killSwitch);
}
