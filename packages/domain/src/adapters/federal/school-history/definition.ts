/**
 * Approved structured school-history sources adapter definition.
 */
import {
  buildFederalAdapterDefinition,
  DEFAULT_FEDERAL_EXPORT_FILTER,
  FEDERAL_SECONDARY_RIGHTS,
} from '../shared/contract-builder.js';

export const SCHOOL_HISTORY_ADAPTER_ID = 'school-history-v1' as const;
export const SCHOOL_HISTORY_PARSER_VERSION = 'parser-1.0.0' as const;

export const schoolHistoryAdapterDefinition = buildFederalAdapterDefinition({
  family: 'school_history',
  adapterId: SCHOOL_HISTORY_ADAPTER_ID,
  parserVersion: SCHOOL_HISTORY_PARSER_VERSION,
  displayName: 'Approved Structured School History Sources',
  classification: 'reputable_secondary',
  stableIdScheme: 'school-history-ref',
  sourceId: 'src_school_history',
  organizationId: 'org_education',
  rights: FEDERAL_SECONDARY_RIGHTS,
  permittedClaimClasses: ['institutional_fact', 'biographical_fact'],
  rateLimits: { requestsPerMinute: 10, burst: 2 },
  expectedRecordsPerRun: 40,
  refreshSchedule: '0 2 * * 0',
  retention: {
    requiredFields: ['stableIdentifier', 'title', 'curriculumTier'],
    minTitleLength: 5,
    allowedClassifications: ['reputable_secondary', 'government_record'],
    requireCanonicalUrl: true,
  },
  exportFilter: {
    ...DEFAULT_FEDERAL_EXPORT_FILTER,
    maxPayloadBytes: 6_144,
    stripKeys: [...DEFAULT_FEDERAL_EXPORT_FILTER.stripKeys, 'lessonPlanBody', 'worksheetPdf'],
    essentialKeys: [
      'stableIdentifier',
      'title',
      'canonicalUrl',
      'classification',
      'curriculumTier',
      'gradeBand',
      'publisher',
    ],
  },
});
