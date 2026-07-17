/**
 * National Archives (NARA) catalog adapter definition (BB-046).
 */
import {
  buildFederalAdapterDefinition,
  DEFAULT_FEDERAL_EXPORT_FILTER,
  DEFAULT_FEDERAL_RETENTION,
  FEDERAL_GOVERNMENT_RECORD_RIGHTS,
} from '../shared/contract-builder.js';

export const NARA_ADAPTER_ID = 'nara-catalog-v1' as const;
export const NARA_PARSER_VERSION = 'parser-1.2.0' as const;

export const naraAdapterDefinition = buildFederalAdapterDefinition({
  family: 'nara',
  adapterId: NARA_ADAPTER_ID,
  parserVersion: NARA_PARSER_VERSION,
  displayName: 'National Archives Catalog',
  classification: 'primary_archival',
  stableIdScheme: 'nara-naid',
  sourceId: 'src_nara',
  organizationId: 'org_nara',
  rights: FEDERAL_GOVERNMENT_RECORD_RIGHTS,
  permittedClaimClasses: ['biographical_fact', 'institutional_fact'],
  rateLimits: { requestsPerMinute: 30, burst: 5 },
  expectedRecordsPerRun: 100,
  refreshSchedule: '0 6 * * 1',
  retention: DEFAULT_FEDERAL_RETENTION,
  exportFilter: {
    ...DEFAULT_FEDERAL_EXPORT_FILTER,
    stripKeys: [...DEFAULT_FEDERAL_EXPORT_FILTER.stripKeys, 'digitalObjects', 'scopeAndContentNote'],
    essentialKeys: ['stableIdentifier', 'title', 'canonicalUrl', 'classification', 'recordGroup', 'series'],
  },
});
