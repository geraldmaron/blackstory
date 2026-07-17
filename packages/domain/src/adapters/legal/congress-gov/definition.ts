/**
 * Congress.gov API v3 adapter definition for federal statute monitoring (fixtures-only in tests).
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../../candidates.js';
import type { SourceAdapterContract } from '../../types.js';

export const CONGRESS_GOV_ADAPTER_ID = 'congress-gov-v3' as const;
export const CONGRESS_GOV_PARSER_VERSION = 'parser-1.0.0' as const;

const PUBLIC_DOMAIN_RIGHTS = {
  defaultStatus: 'public_domain' as const,
  publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt'] as const,
  prohibitedUses: ['unattributed_reuse'] as const,
};

export function createCongressGovAdapterContract(): SourceAdapterContract {
  return {
    adapterId: CONGRESS_GOV_ADAPTER_ID,
    parserVersion: CONGRESS_GOV_PARSER_VERSION,
    displayName: 'Congress.gov API v3',
    classification: 'government_record',
    stableIdScheme: 'congress-law',
    policy: {
      snapshotMode: 'selective',
      rights: PUBLIC_DOMAIN_RIGHTS,
      permittedClaimClasses: ['legal_statute', 'legal_status'],
      refreshSchedule: '0 6 * * *',
      notes: 'api.data.gov key required for live calls; fixtures-only in repo tests.',
    },
    rights: PUBLIC_DOMAIN_RIGHTS,
    permittedClaimClasses: ['legal_statute', 'legal_status'],
    refreshSchedule: '0 6 * * *',
    rateLimits: { requestsPerMinute: 60, burst: 10 },
    volume: { expectedRecordsPerRun: 50, countToleranceFraction: 0.2 },
    geographicCoverage: { countries: ['US'] },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
  };
}
