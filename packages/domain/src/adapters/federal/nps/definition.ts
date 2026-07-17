/**
 * National Park Service and National Register adapter definition (BB-046).
 */
import {
  buildFederalAdapterDefinition,
  DEFAULT_FEDERAL_EXPORT_FILTER,
  DEFAULT_FEDERAL_RETENTION,
  FEDERAL_GOVERNMENT_RECORD_RIGHTS,
} from '../shared/contract-builder.js';

export const NPS_ADAPTER_ID = 'nps-national-register-v1' as const;
export const NPS_PARSER_VERSION = 'parser-1.0.0' as const;

export const npsAdapterDefinition = buildFederalAdapterDefinition({
  family: 'nps',
  adapterId: NPS_ADAPTER_ID,
  parserVersion: NPS_PARSER_VERSION,
  displayName: 'NPS National Register of Historic Places',
  classification: 'government_record',
  stableIdScheme: 'nps-nrhp-ref',
  sourceId: 'src_nps',
  organizationId: 'org_nps',
  rights: FEDERAL_GOVERNMENT_RECORD_RIGHTS,
  permittedClaimClasses: ['geographic_fact', 'institutional_fact', 'biographical_fact'],
  rateLimits: { requestsPerMinute: 15, burst: 2 },
  expectedRecordsPerRun: 75,
  refreshSchedule: '0 5 * * 4',
  retention: {
    ...DEFAULT_FEDERAL_RETENTION,
    allowedClassifications: ['government_record', 'primary_archival'],
  },
  exportFilter: {
    ...DEFAULT_FEDERAL_EXPORT_FILTER,
    stripKeys: [...DEFAULT_FEDERAL_EXPORT_FILTER.stripKeys, 'boundaryGeojson', 'photoArchive'],
    essentialKeys: [
      'stableIdentifier',
      'title',
      'canonicalUrl',
      'classification',
      'nrhpReference',
      'state',
      'locality',
    ],
  },
});
