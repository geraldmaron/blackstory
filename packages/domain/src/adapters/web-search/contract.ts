/**
 * Web-search adapter contract defaults aligned with SourceAdapterContract.
 * Starts disabled by default -- same isolation as every other adapter (../gates.ts) -- but note
 * this is only ONE of two independent gates for this adapter family: even an approved/canary
 * registry entry cannot produce a persisted result unless the caller's
 * `WebSearchProviderConfig.storageTermsConfirmed` is also true (./normalizer.ts
 * `assertStorageTermsConfirmed`).
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../candidates.js';
import type { SourceAdapterContract } from '../types.js';
import {
  BRAVE_SEARCH_ADAPTER_ID,
  WEB_SEARCH_DEFAULT_CLASSIFICATION,
  WEB_SEARCH_PARSER_VERSION,
  WEB_SEARCH_STABLE_ID_SCHEME,
} from './types.js';

export function createBraveSearchAdapterContract(overrides: Partial<SourceAdapterContract> = {}): SourceAdapterContract {
  return {
    adapterId: BRAVE_SEARCH_ADAPTER_ID,
    parserVersion: WEB_SEARCH_PARSER_VERSION,
    displayName: 'Brave Search API Discovery',
    classification: WEB_SEARCH_DEFAULT_CLASSIFICATION,
    stableIdScheme: WEB_SEARCH_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: {
        defaultStatus: 'unknown',
        publicationPermissions: ['cite', 'short_excerpt'],
        prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
      },
      permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
      refreshSchedule: '0 */12 * * *',
      notes:
        'Brave Search API storage-rights tier required before persistence -- see ' +
        '../web-search/provider-decision.ts and normalizer.ts assertStorageTermsConfirmed. ' +
        'Adapter starts disabled by default () independent of the storage-terms gate.',
    },
    rights: {
      defaultStatus: 'unknown',
      publicationPermissions: ['cite', 'short_excerpt'],
      prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
    },
    permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
    refreshSchedule: '0 */12 * * *',
    rateLimits: { requestsPerMinute: 10, burst: 3 },
    volume: { expectedRecordsPerRun: 100, countToleranceFraction: 0.5 },
    geographicCoverage: { countries: ['US'] },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    canarySampleFraction: 0.05,
    ...overrides,
  };
}
