/**
 * Chronicling America (LoC historic newspapers) adapter types.
 *
 * Fixtures mimic the loc.gov JSON API search/item response shapes for the
 * `chronicling-america` collection. This module defines types and parsers only; harvesting is
 * not done here. Parsers are defensive so field renames on the LoC side do not poison batches.
 */
import type { RightsPolicy } from '../../provenance/rights.js';
import type { EvidenceSource } from '../../provenance/source.js';
import type { AdapterCandidateRecord, SourceAdapterContract } from '../types.js';

export const CHRONICLING_AMERICA_ADAPTER_ID = 'chronicling-america-v1' as const;
export const CHRONICLING_AMERICA_PARSER_VERSION = 'chronicling-america-parser-1.0.0' as const;
export const CHRONICLING_AMERICA_STABLE_ID_SCHEME = 'ca-lccn-resource' as const;
export const CHRONICLING_AMERICA_PAYLOAD_SCHEMA_VERSION = 'chronicling-america-payload.v1' as const;

/** NDNP digitized newspapers are government-funded primary archival material. */
export const CHRONICLING_AMERICA_DEFAULT_CLASSIFICATION = 'primary_archival' as const;

export const CHRONICLING_AMERICA_SOURCE_ID = 'src_chronicling_america' as const;
export const CHRONICLING_AMERICA_ORG_ID = 'org_loc' as const;

/**
 * Campaign budget defaults aligned with discovery roster caps (500 / 40 / 10 / retries 2) and
 * documented in `docs/research/chronicling-america-adapter.md`. `maxCandidates` matches
 * `@repo/security`'s `DEFAULT_RESEARCH_CAMPAIGN_BUDGET.maxCandidatesPerRun`. Held as literals
 * here so the adapter's budget is readable at the adapter; `chronicling-america.test.ts` pins
 * the numbers.
 */
export const CHRONICLING_AMERICA_CAMPAIGN_BUDGET = {
  maxCandidates: 500,
  maxQuarantined: 40,
  maxDeadLetter: 10,
  maxRetriesPerCandidate: 2,
} as const;

/** Normalized newspaper record after defensive extraction from a search or item response. */
export type ChroniclingAmericaNormalizedDoc = {
  readonly stableIdentifier: string;
  readonly title: string;
  readonly canonicalUrl: string;
  readonly displayDate?: string;
  readonly publicationTitle?: string;
  readonly publicationPlace?: string;
  readonly location?: readonly string[];
  readonly subjects?: readonly string[];
  readonly lccn?: string;
};

export type ChroniclingAmericaRejectedDoc = {
  readonly index: number;
  readonly stableIdentifier: string;
  readonly reason: string;
};

export type ChroniclingAmericaParsedBatch = {
  readonly docs: readonly ChroniclingAmericaNormalizedDoc[];
  readonly rejected: readonly ChroniclingAmericaRejectedDoc[];
  readonly paginationTotal?: number;
};

export type ChroniclingAmericaCandidatePayload = {
  readonly schemaVersion: typeof CHRONICLING_AMERICA_PAYLOAD_SCHEMA_VERSION;
  readonly lccn?: string;
  readonly displayDate?: string;
  readonly publicationTitle?: string;
  readonly publicationPlace?: string;
  readonly location?: readonly string[];
  readonly subjects?: readonly string[];
  /** Capped to evidence-pointer snippet limits; never OCR full text. */
  readonly summary?: string;
};

export type ChroniclingAmericaCandidateRecord = AdapterCandidateRecord & {
  readonly payload: ChroniclingAmericaCandidatePayload;
};

export type RawChroniclingAmericaRecord = Readonly<Record<string, unknown>>;

export type ChroniclingAmericaRejectedRecord = {
  readonly stableIdentifier: string;
  readonly reason: string;
};

export type ChroniclingAmericaParseResult = {
  readonly candidates: readonly AdapterCandidateRecord[];
  readonly rejected: readonly ChroniclingAmericaRejectedRecord[];
  readonly filteredExportCount: number;
};

export type ChroniclingAmericaRetentionRules = {
  readonly requiredFields: readonly string[];
  readonly minTitleLength: number;
  readonly allowedClassifications: readonly string[];
  readonly requireCanonicalUrl: boolean;
};

export type ChroniclingAmericaExportFilterPolicy = {
  readonly maxPayloadBytes: number;
  readonly stripKeys: readonly string[];
  readonly essentialKeys: readonly string[];
};

export type ChroniclingAmericaAdapterDefinition = {
  readonly adapterId: string;
  readonly killSwitchId: string;
  readonly contract: SourceAdapterContract;
  readonly evidenceSource: Omit<EvidenceSource, 'createdAt' | 'updatedAt'>;
  readonly rights: RightsPolicy;
  readonly retention: ChroniclingAmericaRetentionRules;
  readonly exportFilter: ChroniclingAmericaExportFilterPolicy;
};
