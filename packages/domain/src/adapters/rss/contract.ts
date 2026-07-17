/**
 * RSS/Atom adapter contract defaults aligned with BB-037 SourceAdapterContract (BB-073).
 * Starts disabled by default — same isolation as BB-045/046 — and requires an approved policy
 * before `assertAdapterMayRun` (../gates.ts) will let it run.
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../candidates.js';
import type { SourceAdapterContract } from '../types.js';
import { RSS_ADAPTER_ID, RSS_PARSER_VERSION, RSS_STABLE_ID_SCHEME } from './types.js';

export const RSS_ATTRIBUTION_NOTICE =
  'Content derived from RSS/Atom syndication feeds retains the publisher as the attributed ' +
  'source; only title, link, and a short syndicated summary are stored (BB-077 evidence-pointer doctrine).';

export function createRssAdapterContract(overrides: Partial<SourceAdapterContract> = {}): SourceAdapterContract {
  return {
    adapterId: RSS_ADAPTER_ID,
    parserVersion: RSS_PARSER_VERSION,
    displayName: 'Community RSS/Atom Discovery',
    classification: 'news_reportage',
    stableIdScheme: RSS_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: {
        defaultStatus: 'licensed',
        publicationPermissions: ['cite', 'short_excerpt'],
        prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
      },
      permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
      refreshSchedule: '0 */6 * * *',
      notes: 'Publisher-syndicated feeds; curated registry only (BB-073).',
    },
    rights: {
      defaultStatus: 'licensed',
      publicationPermissions: ['cite', 'short_excerpt'],
      prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
    },
    permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
    refreshSchedule: '0 */6 * * *',
    rateLimits: { requestsPerMinute: 30, burst: 5 },
    volume: { expectedRecordsPerRun: 50, countToleranceFraction: 0.4 },
    geographicCoverage: { countries: ['US'], notes: 'Curated US historical-society/library/museum feeds' },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    canarySampleFraction: 0.1,
    ...overrides,
  };
}
