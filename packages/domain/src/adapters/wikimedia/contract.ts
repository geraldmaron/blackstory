/**
 * Wikimedia adapter contract defaults aligned with SourceAdapterContract.
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../candidates.js';
import type { SourceAdapterContract } from '../types.js';
import {
  WIKIMEDIA_ADAPTER_ID,
  WIKIMEDIA_PARSER_VERSION,
  WIKIMEDIA_STABLE_ID_SCHEME,
} from './types.js';

export const WIKIMEDIA_ATTRIBUTION = {
  sourceProject: 'Wikimedia Foundation',
  license: 'CC BY-SA 4.0',
  attributionUrl: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',
  requiredNotice:
    'Content derived from Wikimedia projects is available under CC BY-SA 4.0; reuse requires attribution.',
} as const;

export function createWikimediaAdapterContract(
  overrides: Partial<SourceAdapterContract> = {},
): SourceAdapterContract {
  return {
    adapterId: WIKIMEDIA_ADAPTER_ID,
    parserVersion: WIKIMEDIA_PARSER_VERSION,
    displayName: 'Wikimedia Discovery',
    classification: 'secondary_reference',
    stableIdScheme: WIKIMEDIA_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: {
        defaultStatus: 'licensed',
        publicationPermissions: ['cite'],
        prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
      },
      permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
      refreshSchedule: '0 4 * * 0',
    },
    rights: {
      defaultStatus: 'licensed',
      publicationPermissions: ['cite'],
      prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
    },
    permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
    refreshSchedule: '0 4 * * 0',
    rateLimits: { requestsPerMinute: 60, burst: 10 },
    volume: { expectedRecordsPerRun: 250, countToleranceFraction: 0.2 },
    geographicCoverage: { countries: ['global'], notes: 'English Wikipedia primary; Wikidata global' },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    canarySampleFraction: 0.05,
    ...overrides,
  };
}
