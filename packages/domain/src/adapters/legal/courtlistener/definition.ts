/**
 * CourtListener bulk CSV adapter definition for landmark case corpus (fixtures-only in tests).
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../../candidates.js';
import type { SourceAdapterContract } from '../../types.js';

export const COURTLISTENER_ADAPTER_ID = 'courtlistener-bulk' as const;
export const COURTLISTENER_PARSER_VERSION = 'parser-1.0.0' as const;

const PUBLIC_DOMAIN_RIGHTS = {
  defaultStatus: 'public_domain' as const,
  publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt'] as const,
  prohibitedUses: ['unattributed_reuse'] as const,
};

export function createCourtListenerAdapterContract(): SourceAdapterContract {
  return {
    adapterId: COURTLISTENER_ADAPTER_ID,
    parserVersion: COURTLISTENER_PARSER_VERSION,
    displayName: 'CourtListener Bulk CSV',
    classification: 'government_record',
    stableIdScheme: 'courtlistener-opinion-id',
    policy: {
      snapshotMode: 'selective',
      rights: PUBLIC_DOMAIN_RIGHTS,
      permittedClaimClasses: ['legal_case', 'court_precedent'],
      refreshSchedule: '0 7 * * *',
      notes: 'Bulk CSVs preferred over paid API tier.',
    },
    rights: PUBLIC_DOMAIN_RIGHTS,
    permittedClaimClasses: ['legal_case', 'court_precedent'],
    refreshSchedule: '0 7 * * *',
    rateLimits: { requestsPerMinute: 10, burst: 2 },
    volume: { expectedRecordsPerRun: 100, countToleranceFraction: 0.25 },
    geographicCoverage: { countries: ['US'] },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
  };
}
