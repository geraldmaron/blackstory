/**
 * Internet Archive adapter contract defaults aligned with SourceAdapterContract.
 * Starts disabled by default and requires an approved policy before it may run (../gates.ts).
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../candidates.js';
import type { SourceAdapterContract } from '../types.js';
import {
  INTERNET_ARCHIVE_ADAPTER_ID,
  INTERNET_ARCHIVE_DEFAULT_CLASSIFICATION,
  INTERNET_ARCHIVE_PARSER_VERSION,
  INTERNET_ARCHIVE_STABLE_ID_SCHEME,
} from './types.js';

export function createInternetArchiveAdapterContract(
  overrides: Partial<SourceAdapterContract> = {},
): SourceAdapterContract {
  return {
    adapterId: INTERNET_ARCHIVE_ADAPTER_ID,
    parserVersion: INTERNET_ARCHIVE_PARSER_VERSION,
    displayName: 'Internet Archive Discovery',
    classification: INTERNET_ARCHIVE_DEFAULT_CLASSIFICATION,
    stableIdScheme: INTERNET_ARCHIVE_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: {
        defaultStatus: 'unknown',
        publicationPermissions: ['cite', 'short_excerpt'],
        prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
      },
      permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
      refreshSchedule: '0 5 * * *',
      notes: 'Open API, no approval gate at IA; adapter still starts disabled ().',
    },
    rights: {
      defaultStatus: 'unknown',
      publicationPermissions: ['cite', 'short_excerpt'],
      prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
    },
    permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
    refreshSchedule: '0 5 * * *',
    rateLimits: { requestsPerMinute: 60, burst: 10 },
    volume: { expectedRecordsPerRun: 300, countToleranceFraction: 0.3 },
    geographicCoverage: { countries: ['global'], notes: 'Digitized newspapers, city directories, community uploads' },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    canarySampleFraction: 0.05,
    ...overrides,
  };
}
