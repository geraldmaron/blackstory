/**
 * Discovery pipeline types: candidates, campaigns, budgets, and run receipts.
 * Discovery produces private research candidates only never public entities.
 */
import type { AdapterCandidateRecord } from '../adapters/types.js';
import type { ContentHash } from '../provenance/hashes.js';
import type {
  MatchOutcome,
  QueryPack,
  SignalStrength,
  StampedDiscoveryRun,
  TermClass,
} from '../query-packs/types.js';

export const DISCOVERY_CANDIDATE_SCHEMA_VERSION = 'discovery-candidate.v1' as const;

export const DISCOVERY_CANDIDATE_STATUSES = [
  'pending',
  'accepted',
  'quarantined',
  'dead_letter',
  'merged',
] as const;

export type DiscoveryCandidateStatus = (typeof DISCOVERY_CANDIDATE_STATUSES)[number];

export const DISCOVERY_FAILURE_OUTCOMES = ['retry', 'quarantine', 'dead_letter'] as const;

export type DiscoveryFailureOutcome = (typeof DISCOVERY_FAILURE_OUTCOMES)[number];

export const DISCOVERY_INGEST_MODES = ['bulk', 'api'] as const;

export type DiscoveryIngestMode = (typeof DISCOVERY_INGEST_MODES)[number];

/** Stable reference back to adapter provenance and source registry. */
export type SourceReference = {
  readonly sourceId: string;
  readonly adapterId: string;
  readonly parserVersion: string;
  readonly registryEntryId: string;
  readonly runId: string;
  readonly capturedAt: string;
  readonly sourceItemId?: string;
  readonly stableIdentifier: string;
};

/** Candidate identity derived from stable adapter identifiers and content hash. */
export type DiscoveryCandidateIdentity = {
  readonly identityKey: string;
  readonly stableIdentifier: string;
  readonly contentHash: ContentHash;
  readonly sourceReferences: readonly SourceReference[];
};

export type GeographicHint = {
  readonly text: string;
  readonly kind: 'state' | 'city' | 'region' | 'country' | 'unknown';
  readonly confidence: number;
};

export type DiscoverySignal = {
  readonly strength: SignalStrength;
  readonly outcome: MatchOutcome;
  readonly matchedClasses: readonly TermClass[];
  readonly matchedTerms: readonly string[];
  readonly reasons: readonly string[];
};

export type DiscoveryCandidateRecord = {
  readonly schemaVersion: typeof DISCOVERY_CANDIDATE_SCHEMA_VERSION;
  readonly id: string;
  readonly identity: DiscoveryCandidateIdentity;
  readonly adapterRecord: AdapterCandidateRecord;
  readonly status: DiscoveryCandidateStatus;
  readonly ingestMode: DiscoveryIngestMode;
  readonly signals: DiscoverySignal;
  readonly geographicHints: readonly GeographicHint[];
  readonly failureOutcome?: DiscoveryFailureOutcome;
  readonly failureReason?: string;
  readonly retryCount: number;
  readonly mergedIntoId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type DiscoveryCampaignBudget = {
  readonly maxCandidates: number;
  readonly maxQuarantined: number;
  readonly maxDeadLetter: number;
  readonly maxRetriesPerCandidate: number;
};

export type DiscoveryCampaignBoundaries = {
  readonly countries: readonly string[];
  readonly entityKind?: string;
  readonly theme?: string;
  readonly adapterIds?: readonly string[];
};

export type DiscoveryCampaignConfig = {
  readonly campaignId: string;
  readonly budget: DiscoveryCampaignBudget;
  readonly boundaries: DiscoveryCampaignBoundaries;
  readonly continueOnQuarantine: boolean;
};

export type DiscoveryReproducibilityStamp = {
  readonly sourceParserVersions: readonly string[];
  readonly queryPackVersionId: string;
  readonly queryPackContentHash: string;
  readonly fingerprint: string;
};

export type DiscoveryCampaignResult = {
  readonly campaignId: string;
  readonly run: StampedDiscoveryRun;
  readonly pack: Pick<QueryPack, 'id' | 'versionId' | 'version'>;
  readonly reproducibility: DiscoveryReproducibilityStamp;
  readonly candidates: readonly DiscoveryCandidateRecord[];
  readonly acceptedCount: number;
  readonly quarantinedCount: number;
  readonly deadLetterCount: number;
  readonly mergedCount: number;
  readonly skippedCount: number;
  readonly completedAt: string;
};

export type BulkIngestBatch = {
  readonly records: readonly AdapterCandidateRecord[];
  readonly ingestMode?: DiscoveryIngestMode;
};

export type ApiIngestRequest = {
  readonly record: AdapterCandidateRecord;
};

export type DiscoveryQuarantineRecord = {
  readonly candidateId: string;
  readonly reason: string;
  readonly outcome: DiscoveryFailureOutcome;
  readonly retryCount: number;
  readonly recordedAt: string;
};
