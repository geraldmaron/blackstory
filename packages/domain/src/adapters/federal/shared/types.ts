/**
 * Shared federal adapter types for fixture-based discovery.
 */
import type {
  AdapterCandidateRecord,
  AdapterRunOutcome,
  SourceAdapterContract,
} from '../../types.js';
import type { EvidenceSource } from '../../../provenance/source.js';
import type { RightsPolicy } from '../../../provenance/rights.js';

export type FederalAdapterFamily = 'loc' | 'nara' | 'dpla' | 'nps' | 'school_history';

export type FederalRetentionRules = {
  readonly requiredFields: readonly string[];
  readonly minTitleLength: number;
  readonly allowedClassifications: readonly string[];
  readonly requireCanonicalUrl: boolean;
};

export type FederalExportFilterPolicy = {
  /** Maximum serialized payload bytes retained on a candidate record. */
  readonly maxPayloadBytes: number;
  /** Top-level keys always stripped from raw exports (bulk blobs). */
  readonly stripKeys: readonly string[];
  /** Keys retained even when the export exceeds maxPayloadBytes. */
  readonly essentialKeys: readonly string[];
};

export type FederalAdapterDefinition = {
  readonly family: FederalAdapterFamily;
  readonly adapterId: string;
  readonly killSwitchId: string;
  readonly contract: SourceAdapterContract;
  readonly evidenceSource: Omit<EvidenceSource, 'createdAt' | 'updatedAt'>;
  readonly rights: RightsPolicy;
  readonly retention: FederalRetentionRules;
  readonly exportFilter: FederalExportFilterPolicy;
};

export type RawFederalExportRecord = Readonly<Record<string, unknown>>;

export type FederalParseResult = {
  readonly candidates: readonly AdapterCandidateRecord[];
  readonly rejected: readonly FederalRejectedRecord[];
  readonly filteredExportCount: number;
};

export type FederalRejectedRecord = {
  readonly stableIdentifier: string;
  readonly reason: string;
};

export type IsolatedFederalRunResult = {
  readonly adapterId: string;
  readonly runId: string;
  readonly outcome: AdapterRunOutcome;
  readonly candidateCount: number;
  readonly issues: readonly string[];
  readonly completedAt: string;
  /** Adapter failures never mutate publication state. */
  readonly publicationImpact: 'none';
  readonly candidates: readonly AdapterCandidateRecord[];
};
