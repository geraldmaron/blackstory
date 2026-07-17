/**
 * eCFR Versioner adapter definition for federal regulation monitoring (fixtures-only in tests).
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../../candidates.js';
import type { SourceAdapterContract } from '../../types.js';

export const ECFR_ADAPTER_ID = 'ecfr-versioner' as const;
export const ECFR_PARSER_VERSION = 'parser-1.0.0' as const;

const PUBLIC_DOMAIN_RIGHTS = {
  defaultStatus: 'public_domain' as const,
  publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt'] as const,
  prohibitedUses: ['unattributed_reuse'] as const,
};

export function createEcfrAdapterContract(): SourceAdapterContract {
  return {
    adapterId: ECFR_ADAPTER_ID,
    parserVersion: ECFR_PARSER_VERSION,
    displayName: 'eCFR Versioner API',
    classification: 'government_record',
    stableIdScheme: 'ecfr-title-part',
    policy: {
      snapshotMode: 'selective',
      rights: PUBLIC_DOMAIN_RIGHTS,
      permittedClaimClasses: ['legal_regulation'],
      refreshSchedule: '0 3 * * 1',
      notes: 'No API key; use Versioner API not HTML scraping.',
    },
    rights: PUBLIC_DOMAIN_RIGHTS,
    permittedClaimClasses: ['legal_regulation'],
    refreshSchedule: '0 3 * * 1',
    rateLimits: { requestsPerMinute: 30, burst: 5 },
    volume: { expectedRecordsPerRun: 20, countToleranceFraction: 0.15 },
    geographicCoverage: { countries: ['US'] },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
  };
}
