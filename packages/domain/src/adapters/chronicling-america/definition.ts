/**
 * Chronicling America adapter definition, rights, rate limits, and kill switch.
 */
import {
  buildChroniclingAmericaAdapterDefinition,
  CHRONICLING_AMERICA_PUBLIC_DOMAIN_RIGHTS,
  DEFAULT_CHRONICLING_AMERICA_EXPORT_FILTER,
  DEFAULT_CHRONICLING_AMERICA_RETENTION,
} from './contract-builder.js';
import {
  CHRONICLING_AMERICA_ADAPTER_ID,
  CHRONICLING_AMERICA_DEFAULT_CLASSIFICATION,
  CHRONICLING_AMERICA_ORG_ID,
  CHRONICLING_AMERICA_PARSER_VERSION,
  CHRONICLING_AMERICA_SOURCE_ID,
  CHRONICLING_AMERICA_STABLE_ID_SCHEME,
} from './types.js';

export const chroniclingAmericaAdapterDefinition = buildChroniclingAmericaAdapterDefinition({
  adapterId: CHRONICLING_AMERICA_ADAPTER_ID,
  parserVersion: CHRONICLING_AMERICA_PARSER_VERSION,
  displayName: 'Chronicling America Historic Newspapers',
  classification: CHRONICLING_AMERICA_DEFAULT_CLASSIFICATION,
  stableIdScheme: CHRONICLING_AMERICA_STABLE_ID_SCHEME,
  sourceId: CHRONICLING_AMERICA_SOURCE_ID,
  organizationId: CHRONICLING_AMERICA_ORG_ID,
  rights: CHRONICLING_AMERICA_PUBLIC_DOMAIN_RIGHTS,
  permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'institutional_fact'],
  rateLimits: { requestsPerMinute: 20, burst: 3 },
  expectedRecordsPerRun: 50,
  refreshSchedule: '0 4 * * 3',
  retention: {
    ...DEFAULT_CHRONICLING_AMERICA_RETENTION,
    allowedClassifications: ['primary_archival', 'government_record'],
  },
  exportFilter: {
    ...DEFAULT_CHRONICLING_AMERICA_EXPORT_FILTER,
    stripKeys: [
      ...DEFAULT_CHRONICLING_AMERICA_EXPORT_FILTER.stripKeys,
      'campaigns',
      'extract_timestamp',
      'timestamp',
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
  },
});
