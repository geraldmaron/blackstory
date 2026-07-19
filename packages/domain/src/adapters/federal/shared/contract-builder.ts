/**
 * Builds adapter contracts for federal archive source families.
 */
import type { RightsPolicy } from '../../../provenance/rights.js';
import type { EvidenceSource } from '../../../provenance/source.js';
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../../candidates.js';
import type { RateLimitPolicy, SourceAdapterContract } from '../../types.js';
import { federalAdapterKillSwitchId } from './kill-switch.js';
import type {
  FederalAdapterDefinition,
  FederalAdapterFamily,
  FederalExportFilterPolicy,
  FederalRetentionRules,
} from './types.js';

export type BuildFederalContractInput = {
  readonly family: FederalAdapterFamily;
  readonly adapterId: string;
  readonly parserVersion: string;
  readonly displayName: string;
  readonly classification: string;
  readonly stableIdScheme: string;
  readonly sourceId: string;
  readonly organizationId: string;
  readonly rights: RightsPolicy;
  readonly permittedClaimClasses: readonly string[];
  readonly rateLimits: RateLimitPolicy;
  readonly expectedRecordsPerRun: number;
  readonly countToleranceFraction?: number;
  readonly refreshSchedule: string;
  readonly retention: FederalRetentionRules;
  readonly exportFilter: FederalExportFilterPolicy;
};

export function buildFederalAdapterDefinition(
  input: BuildFederalContractInput,
): FederalAdapterDefinition {
  const killSwitchId = federalAdapterKillSwitchId(input.adapterId);
  const policy = {
    snapshotMode: 'selective' as const,
    rights: input.rights,
    permittedClaimClasses: input.permittedClaimClasses,
    refreshSchedule: input.refreshSchedule,
    notes: `Federal ${input.family} adapter; fixture-only ingestion ().`,
  };

  const contract: SourceAdapterContract = {
    adapterId: input.adapterId,
    parserVersion: input.parserVersion,
    displayName: input.displayName,
    classification: input.classification,
    stableIdScheme: input.stableIdScheme,
    policy,
    rights: input.rights,
    permittedClaimClasses: input.permittedClaimClasses,
    refreshSchedule: input.refreshSchedule,
    rateLimits: input.rateLimits,
    volume: {
      expectedRecordsPerRun: input.expectedRecordsPerRun,
      countToleranceFraction: input.countToleranceFraction ?? 0.25,
    },
    geographicCoverage: { countries: ['US'] },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
  };

  const evidenceSource: Omit<EvidenceSource, 'createdAt' | 'updatedAt'> = {
    id: input.sourceId,
    organizationId: input.organizationId,
    displayName: input.displayName,
    classification: input.classification,
    adapterId: input.adapterId,
    stableIdScheme: input.stableIdScheme,
    policy,
    adapterEnabled: true,
    killSwitchId,
  };

  return {
    family: input.family,
    adapterId: input.adapterId,
    killSwitchId,
    contract,
    evidenceSource,
    rights: input.rights,
    retention: input.retention,
    exportFilter: input.exportFilter,
  };
}

export const FEDERAL_PUBLIC_DOMAIN_RIGHTS: RightsPolicy = {
  defaultStatus: 'public_domain',
  publicationPermissions: ['cite', 'short_excerpt'],
  prohibitedUses: ['biometric_extraction', 'full_text_republication'],
};

export const FEDERAL_GOVERNMENT_RECORD_RIGHTS: RightsPolicy = {
  defaultStatus: 'public_domain',
  publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt'],
  prohibitedUses: ['biometric_extraction', 'commercial_reuse'],
};

export const FEDERAL_SECONDARY_RIGHTS: RightsPolicy = {
  defaultStatus: 'licensed',
  publicationPermissions: ['cite', 'short_excerpt'],
  prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
};

export const DEFAULT_FEDERAL_EXPORT_FILTER: FederalExportFilterPolicy = {
  maxPayloadBytes: 8_192,
  stripKeys: ['fullText', 'ocrText', 'mediaStream', 'binaryBlob', 'attachments'],
  essentialKeys: [
    'id',
    'stableIdentifier',
    'title',
    'canonicalUrl',
    'classification',
    'date',
    'subjects',
  ],
};

export const DEFAULT_FEDERAL_RETENTION: FederalRetentionRules = {
  requiredFields: ['stableIdentifier', 'title'],
  minTitleLength: 3,
  allowedClassifications: ['primary_archival', 'government_record', 'reputable_secondary'],
  requireCanonicalUrl: true,
};
