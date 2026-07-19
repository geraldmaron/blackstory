/**
 * Digital Public Library of America (DPLA) adapter definition.
 */
import {
  buildFederalAdapterDefinition,
  DEFAULT_FEDERAL_EXPORT_FILTER,
  DEFAULT_FEDERAL_RETENTION,
  FEDERAL_SECONDARY_RIGHTS,
} from '../shared/contract-builder.js';

export const DPLA_ADAPTER_ID = 'dpla-items-v1' as const;
export const DPLA_PARSER_VERSION = 'parser-1.0.0' as const;

export const dplaAdapterDefinition = buildFederalAdapterDefinition({
  family: 'dpla',
  adapterId: DPLA_ADAPTER_ID,
  parserVersion: DPLA_PARSER_VERSION,
  displayName: 'Digital Public Library of America',
  classification: 'reputable_secondary',
  stableIdScheme: 'dpla-item',
  sourceId: 'src_dpla',
  organizationId: 'org_dpla',
  rights: FEDERAL_SECONDARY_RIGHTS,
  permittedClaimClasses: ['biographical_fact', 'geographic_fact'],
  rateLimits: { requestsPerMinute: 60, burst: 10 },
  expectedRecordsPerRun: 200,
  refreshSchedule: '0 3 * * 3',
  retention: {
    ...DEFAULT_FEDERAL_RETENTION,
    allowedClassifications: ['primary_archival', 'government_record', 'reputable_secondary'],
  },
  exportFilter: {
    ...DEFAULT_FEDERAL_EXPORT_FILTER,
    maxPayloadBytes: 4_096,
    stripKeys: [...DEFAULT_FEDERAL_EXPORT_FILTER.stripKeys, 'aggregatedPreview', 'providerRecord'],
    essentialKeys: [
      'stableIdentifier',
      'title',
      'canonicalUrl',
      'classification',
      'provider',
      'date',
    ],
  },
});
