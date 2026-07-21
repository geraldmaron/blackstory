/**
 * Builds the Chronicling America adapter contract and evidence-source snapshot.
 */
import type { RightsPolicy } from '../../provenance/rights.js';
import type { EvidenceSource } from '../../provenance/source.js';
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../candidates.js';
import type { RateLimitPolicy, SourceAdapterContract } from '../types.js';
import { chroniclingAmericaKillSwitchId } from './kill-switch.js';
import type {
  ChroniclingAmericaAdapterDefinition,
  ChroniclingAmericaExportFilterPolicy,
  ChroniclingAmericaRetentionRules,
} from './types.js';

export type BuildChroniclingAmericaContractInput = {
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
  readonly retention: ChroniclingAmericaRetentionRules;
  readonly exportFilter: ChroniclingAmericaExportFilterPolicy;
};

export const CHRONICLING_AMERICA_PUBLIC_DOMAIN_RIGHTS: RightsPolicy = {
  defaultStatus: 'public_domain',
  publicationPermissions: ['cite', 'short_excerpt'],
  prohibitedUses: ['biometric_extraction', 'full_text_republication'],
};

export const DEFAULT_CHRONICLING_AMERICA_EXPORT_FILTER: ChroniclingAmericaExportFilterPolicy = {
  maxPayloadBytes: 8_192,
  stripKeys: [
    'full_text',
    'fullText',
    'ocrText',
    'ocr_text',
    'imageTiles',
    'image_url',
    'segments',
    'mediaStream',
    'binaryBlob',
    'attachments',
  ],
  essentialKeys: [
    'stableIdentifier',
    'title',
    'canonicalUrl',
    'classification',
    'lccn',
    'displayDate',
    'publicationTitle',
    'publicationPlace',
    'subjects',
    'location',
  ],
};

export const DEFAULT_CHRONICLING_AMERICA_RETENTION: ChroniclingAmericaRetentionRules = {
  requiredFields: ['stableIdentifier', 'title'],
  minTitleLength: 3,
  allowedClassifications: ['primary_archival', 'government_record'],
  requireCanonicalUrl: true,
};

export function buildChroniclingAmericaAdapterDefinition(
  input: BuildChroniclingAmericaContractInput,
): ChroniclingAmericaAdapterDefinition {
  const killSwitchId = chroniclingAmericaKillSwitchId(input.adapterId);
  const policy = {
    snapshotMode: 'selective' as const,
    rights: input.rights,
    permittedClaimClasses: input.permittedClaimClasses,
    refreshSchedule: input.refreshSchedule,
    notes:
      'Chronicling America historic newspapers via loc.gov JSON API; fixture-only ingestion. ' +
      'Black press coverage for local figures absent from federal place records.',
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
    geographicCoverage: {
      countries: ['US'],
      notes: 'NDNP digitized US newspapers; Black press titles prioritized in query packs',
    },
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
    adapterEnabled: false,
    killSwitchId,
  };

  return {
    adapterId: input.adapterId,
    killSwitchId,
    contract,
    evidenceSource,
    rights: input.rights,
    retention: input.retention,
    exportFilter: input.exportFilter,
  };
}
