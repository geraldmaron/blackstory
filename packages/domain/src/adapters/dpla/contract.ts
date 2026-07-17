/**
 * DPLA v2 adapter contract defaults aligned with BB-037 SourceAdapterContract (BB-073).
 * Starts disabled by default and requires an approved policy before it may run (../gates.ts).
 * Distinct from the fixture-only federal DPLA adapter (../federal/dpla/definition.ts,
 * adapterId `dpla-items-v1`) — this one is the live api.dp.la/v2 integration.
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../candidates.js';
import type { SourceAdapterContract } from '../types.js';
import {
  DPLA_V2_ADAPTER_ID,
  DPLA_V2_DEFAULT_CLASSIFICATION,
  DPLA_V2_PARSER_VERSION,
  DPLA_V2_STABLE_ID_SCHEME,
} from './types.js';

export function createDplaV2AdapterContract(overrides: Partial<SourceAdapterContract> = {}): SourceAdapterContract {
  return {
    adapterId: DPLA_V2_ADAPTER_ID,
    parserVersion: DPLA_V2_PARSER_VERSION,
    displayName: 'DPLA v2 Discovery',
    classification: DPLA_V2_DEFAULT_CLASSIFICATION,
    stableIdScheme: DPLA_V2_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: {
        defaultStatus: 'licensed',
        publicationPermissions: ['cite', 'short_excerpt'],
        prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
      },
      permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
      refreshSchedule: '0 6 * * 2',
      notes:
        'Free api.dp.la/v2 key; aggregation program transitions to Cleveland Public Library ' +
        'starting July 2026 — client.ts parses responses defensively to tolerate the churn (BB-073).',
    },
    rights: {
      defaultStatus: 'licensed',
      publicationPermissions: ['cite', 'short_excerpt'],
      prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
    },
    permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
    refreshSchedule: '0 6 * * 2',
    rateLimits: { requestsPerMinute: 60, burst: 10 },
    volume: { expectedRecordsPerRun: 200, countToleranceFraction: 0.3 },
    geographicCoverage: { countries: ['US'] },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    canarySampleFraction: 0.05,
    ...overrides,
  };
}
