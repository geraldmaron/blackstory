/**
 * Source adapter registry types: contract fields, lifecycle states, run outcomes.
 * Extends EvidenceSource SourceAdapterPolicy without duplicating provenance models.
 */
import type { EvidenceSource, SourceAdapterPolicy } from '../provenance/source.js';
import type { RightsPolicy } from '../provenance/rights.js';

/** Registry lifecycle for a registered source adapter policy. */
export const ADAPTER_REGISTRY_STATES = [
  'approved',
  'canary',
  'quarantined',
  'dead_letter',
  'disabled',
] as const;

export type AdapterRegistryState = (typeof ADAPTER_REGISTRY_STATES)[number];

export const ADAPTER_RUN_OUTCOMES = ['success', 'quarantined', 'dead_letter'] as const;

export type AdapterRunOutcome = (typeof ADAPTER_RUN_OUTCOMES)[number];

export type RateLimitPolicy = {
  readonly requestsPerMinute: number;
  readonly burst?: number;
};

export type VolumeExpectation = {
  readonly expectedRecordsPerRun: number;
  /** Fractional tolerance (e.g. 0.15 = ±15%). Unexpected drift triggers quarantine. */
  readonly countToleranceFraction: number;
};

export type GeographicCoverage = {
  /** ISO 3166-1 alpha-2 codes, or the sentinel `global`. */
  readonly countries: readonly string[];
  readonly regions?: readonly string[];
  readonly notes?: string;
};

/**
 * Full adapter contract: identity, rights, permitted claims, operational limits, and parser version.
 * Mirrors Firestore `evidenceSources` plus operational metadata.
 */
export type SourceAdapterContract = {
  readonly adapterId: string;
  readonly parserVersion: string;
  readonly displayName: string;
  readonly classification: string;
  readonly stableIdScheme: string;
  readonly policy: SourceAdapterPolicy;
  readonly rights: RightsPolicy;
  readonly permittedClaimClasses: readonly string[];
  readonly refreshSchedule?: string;
  readonly rateLimits: RateLimitPolicy;
  readonly volume: VolumeExpectation;
  readonly geographicCoverage: GeographicCoverage;
  readonly expectedSchemaVersion: string;
  /** When registry state is `canary`, fraction of records to process (0–1). */
  readonly canarySampleFraction?: number;
};

/** Registry entry combining contract, evidence source snapshot, and approval state. */
export type SourceRegistryEntry = {
  readonly id: string;
  readonly contract: SourceAdapterContract;
  readonly evidenceSource: EvidenceSource;
  readonly registryState: AdapterRegistryState;
  readonly approvedAt?: string;
  readonly approvedBy?: string;
  readonly quarantineReason?: string;
  readonly deadLetterReason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** Provenance stamped on every adapter-produced candidate. */
export type AdapterCandidateProvenance = {
  readonly sourceId: string;
  readonly adapterId: string;
  readonly parserVersion: string;
  readonly registryEntryId: string;
  readonly runId: string;
  readonly capturedAt: string;
  readonly sourceItemId?: string;
  readonly schemaVersion: string;
};

/** Normalized adapter output record prior to promotion into canonical entities. */
export type AdapterCandidateRecord = {
  readonly stableIdentifier: string;
  readonly title?: string;
  readonly canonicalUrl?: string;
  readonly classification?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly provenance: AdapterCandidateProvenance;
};

export type AdapterRunContext = {
  readonly runId: string;
  readonly startedAt: string;
  readonly registryEntry: SourceRegistryEntry;
};

export type AdapterRunResult = {
  readonly runId: string;
  readonly adapterId: string;
  readonly outcome: AdapterRunOutcome;
  readonly candidateCount: number;
  readonly issues: readonly string[];
  readonly completedAt: string;
};
