/**
 * Common Crawl adapter contract defaults aligned with SourceAdapterContract.
 * Starts disabled by default -- same isolation as every other adapter (../gates.ts) -- even
 * though Common Crawl itself needs no storage-rights gate (see types.ts's module doc comment):
 * the registry approval requirement is independent of that question.
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../candidates.js';
import type { SourceAdapterContract } from '../types.js';
import {
  COMMON_CRAWL_ADAPTER_ID,
  COMMON_CRAWL_DEFAULT_CLASSIFICATION,
  COMMON_CRAWL_PARSER_VERSION,
  COMMON_CRAWL_STABLE_ID_SCHEME,
} from './types.js';

export function createCommonCrawlAdapterContract(
  overrides: Partial<SourceAdapterContract> = {},
): SourceAdapterContract {
  return {
    adapterId: COMMON_CRAWL_ADAPTER_ID,
    parserVersion: COMMON_CRAWL_PARSER_VERSION,
    displayName: 'Common Crawl Retrospective Discovery',
    classification: COMMON_CRAWL_DEFAULT_CLASSIFICATION,
    stableIdScheme: COMMON_CRAWL_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: {
        defaultStatus: 'unknown',
        publicationPermissions: ['cite', 'short_excerpt'],
        prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
      },
      permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
      refreshSchedule: '0 4 1 * *',
      notes:
        'Free AWS Open Data / Hugging Face access under Common Crawl research/fair-use terms -- ' +
        'no storage-rights gate needed (). Adapter still starts disabled by default ().',
    },
    rights: {
      defaultStatus: 'unknown',
      publicationPermissions: ['cite', 'short_excerpt'],
      prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
    },
    permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
    refreshSchedule: '0 4 1 * *',
    rateLimits: { requestsPerMinute: 20, burst: 5 },
    volume: { expectedRecordsPerRun: 500, countToleranceFraction: 0.5 },
    geographicCoverage: { countries: ['US'] },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    canarySampleFraction: 0.05,
    ...overrides,
  };
}
