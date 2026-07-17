/**
 * Library of Congress adapter definition, rights, rate limits, and kill switch (BB-046).
 */
import {
  buildFederalAdapterDefinition,
  DEFAULT_FEDERAL_EXPORT_FILTER,
  DEFAULT_FEDERAL_RETENTION,
  FEDERAL_PUBLIC_DOMAIN_RIGHTS,
} from '../shared/contract-builder.js';

export const LOC_ADAPTER_ID = 'loc-collections-v1' as const;
export const LOC_PARSER_VERSION = 'parser-1.0.0' as const;

export const locAdapterDefinition = buildFederalAdapterDefinition({
  family: 'loc',
  adapterId: LOC_ADAPTER_ID,
  parserVersion: LOC_PARSER_VERSION,
  displayName: 'Library of Congress Collections',
  classification: 'primary_archival',
  stableIdScheme: 'loc-lccn',
  sourceId: 'src_loc',
  organizationId: 'org_loc',
  rights: FEDERAL_PUBLIC_DOMAIN_RIGHTS,
  permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'institutional_fact'],
  rateLimits: { requestsPerMinute: 20, burst: 3 },
  expectedRecordsPerRun: 50,
  refreshSchedule: '0 4 * * 2',
  retention: {
    ...DEFAULT_FEDERAL_RETENTION,
    allowedClassifications: ['primary_archival', 'government_record'],
  },
  exportFilter: {
    ...DEFAULT_FEDERAL_EXPORT_FILTER,
    stripKeys: [...DEFAULT_FEDERAL_EXPORT_FILTER.stripKeys, 'imageTiles', 'marcRecord'],
    essentialKeys: ['stableIdentifier', 'title', 'canonicalUrl', 'classification', 'lccn', 'date', 'subjects'],
  },
});
