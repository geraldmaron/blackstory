/**
 * LegiScan free-tier adapter definition for BB-087 state law monitoring (fixtures-only in tests).
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../../candidates.js';
import type { SourceAdapterContract } from '../../types.js';

export const LEGISCAN_ADAPTER_ID = 'legiscan-free' as const;
export const LEGISCAN_PARSER_VERSION = 'parser-1.0.0' as const;

const LINK_ONLY_RIGHTS = {
  defaultStatus: 'licensed' as const,
  publicationPermissions: ['cite'] as const,
  prohibitedUses: ['full_text_republication', 'unattributed_reuse', 'commercial_reuse'] as const,
};

export function createLegiScanAdapterContract(): SourceAdapterContract {
  return {
    adapterId: LEGISCAN_ADAPTER_ID,
    parserVersion: LEGISCAN_PARSER_VERSION,
    displayName: 'LegiScan Free Tier',
    classification: 'government_record',
    stableIdScheme: 'legiscan-bill-id',
    policy: {
      snapshotMode: 'selective',
      rights: LINK_ONLY_RIGHTS,
      permittedClaimClasses: ['legal_statute', 'legal_status'],
      refreshSchedule: '0 8 * * *',
      notes: 'Link official state-code sites; never scrape Justia.',
    },
    rights: LINK_ONLY_RIGHTS,
    permittedClaimClasses: ['legal_statute', 'legal_status'],
    refreshSchedule: '0 8 * * *',
    rateLimits: { requestsPerMinute: 20, burst: 5 },
    volume: { expectedRecordsPerRun: 200, countToleranceFraction: 0.3 },
    geographicCoverage: { countries: ['US'] },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
  };
}
