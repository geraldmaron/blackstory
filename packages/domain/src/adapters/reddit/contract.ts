/**
 * Reddit adapter contract defaults aligned with `SourceAdapterContract` (gated channel).
 * Starts disabled by default — same isolation as every other adapter — and
 * `assertAdapterMayRun` (`../gates.ts`) will not let it run without an approved policy.
 *
 * Human step (blocks everything else): a human must submit Reddit's Responsible Builder
 * application (non-commercial archival-research use case) and record approval before an
 * operator may move this registry entry out of `'disabled'`. This file does not flip that
 * state itself — see the module-level TODO below. Once approval is recorded, operators flip
 * `registryState` via `approveSourcePolicy` / `setRegistryState` in `../registry.ts`.
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../candidates.js';
import type { SourceAdapterContract } from '../types.js';
import {
  REDDIT_ADAPTER_ID,
  REDDIT_DEFAULT_CLASSIFICATION,
  REDDIT_FREE_TIER_QPM_LIMIT,
  REDDIT_PARSER_VERSION,
  REDDIT_STABLE_ID_SCHEME,
} from './types.js';

export const REDDIT_ATTRIBUTION_NOTICE =
  'Reddit threads are discovery leads that point researchers at verifiable primary sources — ' +
  'never evidence of record, never republished. Only title, permalink, and a short triage ' +
  'snippet are stored ( evidence-pointer doctrine); the author handle is never resolved ' +
  'to a real identity.';

/**
 * TODO: Reddit's Responsible Builder application (non-commercial archival-research use case)
 * has not been submitted/approved as of this adapter's build. Do not set `registryState` to
 * `'canary'` or `'approved'` for this contract's registry entry until that approval is
 * recorded — see `docs/runbooks/operator-session.md`. If Reddit denies the application, route
 * Reddit leads through the manual submission lane instead.
 */
export function createRedditAdapterContract(
  overrides: Partial<SourceAdapterContract> = {},
): SourceAdapterContract {
  return {
    adapterId: REDDIT_ADAPTER_ID,
    parserVersion: REDDIT_PARSER_VERSION,
    displayName: 'Reddit Discovery (Gated Channel)',
    classification: REDDIT_DEFAULT_CLASSIFICATION,
    stableIdScheme: REDDIT_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: {
        defaultStatus: 'unknown',
        publicationPermissions: ['cite', 'short_excerpt'],
        prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
      },
      permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
      refreshSchedule: '*/15 * * * *',
      notes:
        'Gated channel (): fixtures-first canary until Reddit Responsible Builder approval ' +
        'is recorded on the bead. Curated subreddit registry only — no broad crawl.',
    },
    rights: {
      defaultStatus: 'unknown',
      publicationPermissions: ['cite', 'short_excerpt'],
      prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
    },
    permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
    refreshSchedule: '*/15 * * * *',
    // Reddit's actual free-tier OAuth ceiling (2026, non-commercial) — the curated subreddit
    // list (5 entries) polled every 15 minutes stays far below this even at the worst-case full
    // 1000-item/10-page listing depth per subreddit; see reddit.test.ts's rate-limit design
    // assertion and ./types.ts REDDIT_LISTING_MAX_ITEMS REDDIT_LISTING_MAX_PAGE_SIZE.
    rateLimits: { requestsPerMinute: REDDIT_FREE_TIER_QPM_LIMIT, burst: 10 },
    volume: { expectedRecordsPerRun: 100, countToleranceFraction: 0.6 },
    geographicCoverage: {
      countries: ['US'],
      notes:
        'Curated topical + city/state subreddits (AskHistorians, BlackHistory, city/state subs)',
    },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    canarySampleFraction: 0.05,
    ...overrides,
  };
}
