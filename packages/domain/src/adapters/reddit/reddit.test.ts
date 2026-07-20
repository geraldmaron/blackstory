/**
 * Tests for the Reddit discovery adapter. Fixture/mock-driven; no live
 * network every HTTP call goes through a mock SafeHttpClient injected by the test, never a
 * real fetch. Reddit access itself is gated behind the Responsible Builder application (a HUMAN
 * STEP, see ./contract.ts) that has not been submitted/approved as of this build, so this suite
 * exists to prove the adapter is correct and safe to flip on later not to exercise a live
 * Reddit account.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { assertNoDeanonymization } from '../../rights/index.js';
import {
  getSourceObligationsOrThrow,
  defaultSourceObligationsSeed,
  createInMemoryObligationsRegistry,
} from '../../rights/index.js';
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  registerSource,
  type SourceRegistryEntry,
} from '../index.js';
import type { SafeHttpResponse } from '../internet-archive/shared/http-port.js';
import * as redditAdapter from './index.js';
import {
  REDDIT_ADAPTER_ID,
  REDDIT_DELETION_SYNC_MAX_HOURS,
  REDDIT_FREE_TIER_QPM_LIMIT,
  REDDIT_STRUCTURAL_LIMITATIONS,
  addSubredditToRegistry,
  applyRedditPointerPurge,
  assertNoForbiddenExportSurface,
  assertPointerLiveBeforeReview,
  buildRedditPointerCascadeTargets,
  checkRedditPostLivenessViaListingLookup,
  createInMemorySubredditRegistry,
  createRedditAdapterContract,
  defaultSubredditRegistrySeed,
  estimateWorstCaseRequestsPerMinute,
  fetchSubredditNewListing,
  fetchSubredditNewListings,
  listActiveSubreddits,
  normalizeRedditBatch,
  planRedditPointerPurge,
  removeSubredditFromRegistry,
  sweepRedditPointerLiveness,
  type RedditLivenessCheckResult,
  type RedditLivenessChecker,
  type RedditStoredPointer,
  type SubredditRegistryEntry,
} from './index.js';
import { parseRedditListingResponse } from './client.js';

const FIXED_NOW = '2026-07-17T20:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixtureJson(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8'));
}

function redditRegistryEntry(): SourceRegistryEntry {
  const contract = createRedditAdapterContract();
  const evidenceSource = {
    id: 'src_reddit',
    organizationId: 'org_community',
    displayName: 'Reddit Discovery (Gated Channel)',
    classification: contract.classification,
    adapterId: REDDIT_ADAPTER_ID,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: 'adapter:reddit',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  return {
    id: 'reg_reddit',
    contract,
    evidenceSource,
    registryState: 'disabled',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

function askHistorians(): SubredditRegistryEntry {
  return {
    id: 'sub_askhistorians',
    subredditName: 'AskHistorians',
    displayName: 'r/AskHistorians',
    classification: 'community_oral',
    category: 'topical',
    status: 'active',
    revision: 1,
    addedAt: FIXED_NOW,
    addedBy: 'admin@blackbook.local',
  };
}

function blackHistory(): SubredditRegistryEntry {
  return {
    id: 'sub_blackhistory',
    subredditName: 'BlackHistory',
    displayName: 'r/BlackHistory',
    classification: 'community_oral',
    category: 'topical',
    status: 'active',
    revision: 1,
    addedAt: FIXED_NOW,
    addedBy: 'admin@blackbook.local',
  };
}

// --- Registry lifecycle obligations -------------------------------------------------------

test('Reddit adapter starts disabled by default and requires an approved policy to run', () => {
  const store = createInMemorySourceRegistry();
  const entry = redditRegistryEntry();
  registerSource(store, {
    id: entry.id,
    contract: entry.contract,
    evidenceSource: entry.evidenceSource,
    createdAt: FIXED_NOW,
  });
  const registered = store.get('reg_reddit');
  assert.equal(registered?.registryState, 'disabled');

  const approved = approveSourcePolicy(store, {
    id: 'reg_reddit',
    approvedBy: 'admin@blackbook.local',
    approvedAt: FIXED_NOW,
    registryState: 'canary',
  });
  assert.equal(approved.registryState, 'canary');
});

test('Reddit adapter contract respects the 100 QPM free tier ceiling', () => {
  const contract = createRedditAdapterContract();
  assert.equal(contract.rateLimits.requestsPerMinute, REDDIT_FREE_TIER_QPM_LIMIT);
});

test('Reddit adapter has a registered  obligations entry with the contractual 48h deletion-sync window', () => {
  const obligationsStore = createInMemoryObligationsRegistry(
    defaultSourceObligationsSeed(FIXED_NOW),
  );
  const obligations = getSourceObligationsOrThrow(obligationsStore, REDDIT_ADAPTER_ID);
  assert.equal(obligations.sourceClass, 'reddit');
  assert.equal(obligations.deletionSync.required, true);
  assert.equal(obligations.deletionSync.maxHours, 48);
  assert.equal(obligations.deletionSync.contractual, true);
  assert.equal(obligations.republicationProhibited, true);
  assert.equal(obligations.mlTrainingProhibited, true);
  assert.equal(obligations.livenessRecheckRequired, true);
  // Cross-check: the adapter's own purge-window constant must never silently drift from the
  // registered obligation.
  assert.equal(REDDIT_DELETION_SYNC_MAX_HOURS, obligations.deletionSync.maxHours);
});

// --- Structural limitations -----------------------------------------------------------------

test('structural gaps are documented as constraints, not bugs', () => {
  const ids = REDDIT_STRUCTURAL_LIMITATIONS.map((limitation) => limitation.id);
  assert.deepEqual(
    [...ids].sort(),
    ['listing_cap_1000_items', 'no_comment_search', 'no_date_range_search'].sort(),
  );
});

// --- Polling rate-limit design ------------------------------------------------------------

test('the curated seed list at a 15-minute cadence stays far under the 100 QPM free tier, even worst-case', () => {
  const seed = defaultSubredditRegistrySeed(FIXED_NOW);
  const worstCase = estimateWorstCaseRequestsPerMinute({
    subredditCount: seed.length,
    cadenceMinutes: 15,
  });
  assert.ok(
    worstCase < REDDIT_FREE_TIER_QPM_LIMIT,
    `worst-case ${worstCase} req/min must be under ${REDDIT_FREE_TIER_QPM_LIMIT}`,
  );
});

// --- Parsing normalization -----------------------------------------------------------------

test('parses a Reddit /new listing page into normalized candidates', () => {
  const entry = {
    ...redditRegistryEntry(),
    registryState: 'approved' as const,
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
  };
  const raw = loadFixtureJson('askhistorians-new-page1.json');
  const parsed = parseRedditListingResponse(raw);
  assert.equal(parsed.posts.length, 2);
  assert.equal(parsed.after, 't3_pc1def');

  const candidates = normalizeRedditBatch({
    subreddit: askHistorians(),
    posts: parsed.posts,
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
  });
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.provenance.adapterId, REDDIT_ADAPTER_ID);
  assert.equal(candidates[0]?.payload.subreddit, 'AskHistorians');
  assert.equal(candidates[0]?.payload.postId, 'pc1abc');
  assert.equal(
    candidates[0]?.payload.permalink,
    'https://www.reddit.com/r/AskHistorians/comments/pc1abc/sources_for_a_freedmens_bureau_field_office_in/',
  );
  assert.equal(candidates[0]?.payload.authorHandle, 'piedmont_researcher');
  assert.ok(candidates[0]?.stableIdentifier.startsWith('reddit:sub_askhistorians:'));
  assert.ok(candidates[0]?.payload.snippet!.length <= 320);
});

test('normalization skips already-removed or already-deleted posts at ingest time', () => {
  const entry = {
    ...redditRegistryEntry(),
    registryState: 'approved' as const,
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
  };
  const raw = loadFixtureJson('blackhistory-new-listing.json');
  const parsed = parseRedditListingResponse(raw);
  assert.equal(parsed.posts.length, 3);

  const candidates = normalizeRedditBatch({
    subreddit: blackHistory(),
    posts: parsed.posts,
    registryEntry: entry,
    runId: 'run_2',
    capturedAt: FIXED_NOW,
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.payload.postId, 'bh1live');
});

test('normalized payload never carries a full post body, comments, or an identity-resolving field', () => {
  const entry = {
    ...redditRegistryEntry(),
    registryState: 'approved' as const,
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
  };
  const raw = loadFixtureJson('askhistorians-new-page1.json');
  const parsed = parseRedditListingResponse(raw);
  const [candidate] = normalizeRedditBatch({
    subreddit: askHistorians(),
    posts: parsed.posts,
    registryEntry: entry,
    runId: 'run_3',
    capturedAt: FIXED_NOW,
  });
  const payloadKeys = Object.keys(candidate!.payload).map((key) => key.toLowerCase());
  for (const forbidden of [
    'selftext',
    'body',
    'comments',
    'email',
    'realname',
    'fullname',
    'authorfullname',
    'ipaddress',
    'accountid',
  ]) {
    assert.equal(payloadKeys.includes(forbidden), false, `payload must not include "${forbidden}"`);
  }
  // Author is stored as a bare handle string only.
  assert.equal(typeof candidate!.payload.authorHandle, 'string');
});

// --- Subreddit registry ------------------------------------------------------------------------

test('subreddit registry add/remove is versioned and produces a  audit event', () => {
  const store = createInMemorySubredditRegistry();
  const actor = { id: 'admin@blackbook.local', type: 'user' as const };

  const added = addSubredditToRegistry(
    store,
    { id: 'sub_detroit', subredditName: 'Detroit', displayName: 'r/Detroit', category: 'city' },
    {
      actor,
      reason: 'Curated seed list — city sub with active neighborhood-history threads.',
      requestId: 'req_1',
      correlationId: 'corr_1',
      now: FIXED_NOW,
    },
  );
  assert.equal(added.entry.status, 'active');
  assert.equal(added.entry.revision, 1);
  assert.equal(added.auditEvent.action, 'administrative.configuration_changed');
  assert.equal(added.auditEvent.data?.mutation, 'subreddit_added');
  assert.equal(listActiveSubreddits(store).length, 1);

  assert.throws(
    () =>
      addSubredditToRegistry(
        store,
        { id: 'sub_detroit', subredditName: 'Detroit', displayName: 'dup', category: 'city' },
        { actor, reason: 'dup', requestId: 'req_2', correlationId: 'corr_2', now: FIXED_NOW },
      ),
    /already exists/,
  );

  const removed = removeSubredditFromRegistry(store, 'sub_detroit', {
    actor,
    reason: 'Subreddit went private.',
    requestId: 'req_3',
    correlationId: 'corr_3',
    now: '2026-07-18T00:00:00.000Z',
  });
  assert.equal(removed.entry.status, 'removed');
  assert.equal(removed.entry.revision, 2);
  assert.equal(listActiveSubreddits(store).length, 0);
});

test('subreddit registry rejects invalid subreddit names and empty removal reasons', () => {
  const store = createInMemorySubredditRegistry();
  const actor = { id: 'admin@blackbook.local', type: 'user' as const };
  assert.throws(
    () =>
      addSubredditToRegistry(
        store,
        { id: 'sub_bad', subredditName: 'r/NotAllowed', displayName: 'bad', category: 'city' },
        { actor, reason: 'r', requestId: 'req', correlationId: 'corr', now: FIXED_NOW },
      ),
    /not a valid Reddit community name/,
  );
});

test('the default subreddit seed is a small, realistic, versioned list', () => {
  const seed = defaultSubredditRegistrySeed(FIXED_NOW);
  assert.ok(seed.length >= 3 && seed.length <= 10);
  const names = seed.map((entry) => entry.subredditName);
  assert.ok(names.includes('AskHistorians'));
  assert.ok(names.includes('BlackHistory'));
  assert.ok(seed.some((entry) => entry.category === 'city' || entry.category === 'state'));
  // Revisions are monotonic starting at 1 versioned config, not a flat unordered list.
  assert.deepEqual(
    seed.map((entry) => entry.revision),
    seed.map((_, index) => index + 1),
  );
});

// --- Fetch pagination -----------------------------------------------------------------------

test('fetchSubredditNewListing paginates via the after cursor through an injected SafeHttpClient (mock, no live network)', async () => {
  const entry = {
    ...redditRegistryEntry(),
    registryState: 'approved' as const,
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
  };
  const page1 = loadFixtureJson('askhistorians-new-page1.json');
  const page2 = loadFixtureJson('askhistorians-new-page2.json');
  let calls = 0;
  const client = async (request: { url: string }): Promise<SafeHttpResponse> => {
    calls += 1;
    const body = request.url.includes('after=t3_pc1def') ? page2 : page1;
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(body),
      finalUrl: request.url,
    };
  };

  const candidates = await fetchSubredditNewListing({
    subreddit: askHistorians(),
    registryEntry: entry,
    runId: 'run_page',
    capturedAt: FIXED_NOW,
    client,
    maxItems: 10,
    pageSize: 2,
  });
  assert.equal(calls, 2);
  assert.equal(candidates.length, 3);
});

test('fetchSubredditNewListing stops once maxItems is reached without requesting further pages', async () => {
  const entry = {
    ...redditRegistryEntry(),
    registryState: 'approved' as const,
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
  };
  const page1 = loadFixtureJson('askhistorians-new-page1.json');
  let calls = 0;
  const client = async (request: { url: string }): Promise<SafeHttpResponse> => {
    calls += 1;
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(page1),
      finalUrl: request.url,
    };
  };

  const candidates = await fetchSubredditNewListing({
    subreddit: askHistorians(),
    registryEntry: entry,
    runId: 'run_cap',
    capturedAt: FIXED_NOW,
    client,
    maxItems: 2,
    pageSize: 2,
  });
  assert.equal(calls, 1, 'must not request a second page once maxItems is already satisfied');
  assert.equal(candidates.length, 2);
});

test('fetchSubredditNewListing retries on 429 and eventually succeeds', async () => {
  const entry = {
    ...redditRegistryEntry(),
    registryState: 'approved' as const,
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
  };
  const page2 = loadFixtureJson('askhistorians-new-page2.json');
  let attempts = 0;
  const client = async (request: { url: string }): Promise<SafeHttpResponse> => {
    attempts += 1;
    if (attempts < 3) {
      return {
        status: 429,
        headers: { 'content-type': 'text/plain' },
        bodyText: '',
        finalUrl: request.url,
      };
    }
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(page2),
      finalUrl: request.url,
    };
  };

  const candidates = await fetchSubredditNewListing({
    subreddit: askHistorians(),
    registryEntry: entry,
    runId: 'run_retry',
    capturedAt: FIXED_NOW,
    client,
    maxItems: 5,
    retries: 5,
  });
  assert.equal(attempts, 3);
  assert.equal(candidates.length, 1);
});

test('fetchSubredditNewListings fans out with modest bounded concurrency', async () => {
  const entry = {
    ...redditRegistryEntry(),
    registryState: 'approved' as const,
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
  };
  const askHistoriansPage = loadFixtureJson('askhistorians-new-page2.json');
  const blackHistoryPage = loadFixtureJson('blackhistory-new-listing.json');
  let inFlight = 0;
  let maxInFlight = 0;
  const client = async (request: { url: string }): Promise<SafeHttpResponse> => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    const isAskHistorians = request.url.includes('/r/AskHistorians/');
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(isAskHistorians ? askHistoriansPage : blackHistoryPage),
      finalUrl: request.url,
    };
  };

  const candidates = await fetchSubredditNewListings({
    subreddits: [askHistorians(), blackHistory()],
    registryEntry: entry,
    runId: 'run_fanout',
    capturedAt: FIXED_NOW,
    client,
    concurrency: 2,
  });
  // 1 from AskHistorians page2 + 1 live (of 3) from BlackHistory.
  assert.equal(candidates.length, 2);
  assert.ok(maxInFlight <= 2);
});

// --- Fail-closed compliance guards ------------------------------------------------------------

test('the adapter export surface has no republication, ML-training, or deanonymization path', () => {
  assert.doesNotThrow(() =>
    assertNoForbiddenExportSurface(redditAdapter as unknown as Record<string, unknown>),
  );
});

test(' deanonymization guard rejects a Reddit-targeted attempt (adapter does not bypass it)', () => {
  assert.throws(
    () =>
      assertNoDeanonymization({
        proposedAction: 'resolve real identity behind a Reddit handle',
        targetsPseudonymousOrAnonymousSubject: true,
      }),
    /Deanonymization is prohibited/,
  );
});

// --- Liveness re-checking -----------------------------------------------------------------------

function storedPointer(overrides: Partial<RedditStoredPointer> = {}): RedditStoredPointer {
  return {
    id: 'ptr_1',
    stableIdentifier: 'reddit:sub_askhistorians:pc1abc',
    subredditRegistryId: 'sub_askhistorians',
    subreddit: 'AskHistorians',
    postId: 'pc1abc',
    permalink:
      'https://www.reddit.com/r/AskHistorians/comments/pc1abc/sources_for_a_freedmens_bureau_field_office_in/',
    authorHandle: 'piedmont_researcher',
    capturedAt: FIXED_NOW,
    snippet: 'Sources for a Freedmen’s Bureau field office in Piedmont County, 1866-1870?',
    ...overrides,
  };
}

test('checkRedditPostLivenessViaListingLookup classifies live, removed, deleted, and not-found posts through a mock client', async () => {
  const livePage = loadFixtureJson('askhistorians-new-page1.json');
  const removedPage = loadFixtureJson('blackhistory-new-listing.json');
  const notFoundPage = loadFixtureJson('info-lookup-not-found.json');

  async function checkWith(
    page: unknown,
    pointer: RedditStoredPointer,
  ): Promise<RedditLivenessCheckResult> {
    const client = async (): Promise<SafeHttpResponse> => ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(page),
      finalUrl: 'https://oauth.reddit.com/api/info',
    });
    return checkRedditPostLivenessViaListingLookup(client)(pointer);
  }

  const live = await checkWith(livePage, storedPointer({ postId: 'pc1abc' }));
  assert.equal(live.live, true);
  assert.equal(live.reason, 'live');

  const notFound = await checkWith(notFoundPage, storedPointer({ postId: 'ghost' }));
  assert.equal(notFound.live, false);
  assert.equal(notFound.reason, 'not_found');

  // blackhistory-new-listing.json's parsed posts[0] is the live one; the classifier only ever
  // looks at the single post the /api/info lookup returns for a given id, so wrap a
  // single-child listing for the removed/deleted cases specifically.
  const removedOnly = {
    kind: 'Listing',
    data: {
      after: null,
      children: [(removedPage as { data: { children: unknown[] } }).data.children[1]],
    },
  };
  const removed = await checkWith(removedOnly, storedPointer({ postId: 'bh1removed' }));
  assert.equal(removed.live, false);
  assert.equal(removed.reason, 'removed_by_moderator_or_admin');

  const deletedOnly = {
    kind: 'Listing',
    data: {
      after: null,
      children: [(removedPage as { data: { children: unknown[] } }).data.children[2]],
    },
  };
  const deleted = await checkWith(deletedOnly, storedPointer({ postId: 'bh1deleted' }));
  assert.equal(deleted.live, false);
  assert.equal(deleted.reason, 'deleted_by_author');
});

test('assertPointerLiveBeforeReview passes on a fresh live check and throws on a fresh dead check', async () => {
  const pointer = storedPointer();
  const liveChecker: RedditLivenessChecker = async (p) => ({
    pointerId: p.id,
    checkedAt: FIXED_NOW,
    live: true,
    reason: 'live',
  });
  const result = await assertPointerLiveBeforeReview(pointer, liveChecker);
  assert.equal(result.live, true);

  const deadChecker: RedditLivenessChecker = async (p) => ({
    pointerId: p.id,
    checkedAt: FIXED_NOW,
    live: false,
    reason: 'deleted_by_author',
  });
  await assert.rejects(() => assertPointerLiveBeforeReview(pointer, deadChecker), /no longer live/);
});

// --- Deletion-sync (real wiring) ---------------------------------------------------------

test('planRedditPointerPurge builds a real  DeletionSyncPlan covering every cascade stage', () => {
  const pointer = storedPointer();
  const actor = { id: 'system:reddit-deletion-sync', type: 'service' as const };
  const plan = planRedditPointerPurge({
    pointer,
    cascadePaths: {
      quarantinePath: `submissionQuarantine/${pointer.id}`,
      graylistPath: `discoveryGraylist/${pointer.id}`,
      researchCaseAttachmentPath: `researchCases/case_1/attachments/${pointer.id}`,
    },
    reason: 'Upstream deletion detected by liveness sweep',
    correlationId: 'corr_purge_1',
    requestedAt: FIXED_NOW,
    actor,
  });

  assert.equal(plan.mutations.length, 3);
  assert.deepEqual(
    plan.mutations.map((m) => m.kind).sort(),
    ['graylist', 'quarantine', 'research_case_attachment'].sort(),
  );
  assert.equal(plan.record.adapterId, REDDIT_ADAPTER_ID);
  assert.equal(plan.record.purgedTargetCount, 3);
  assert.equal(plan.auditEvent.action, 'deletion.purged');
  assert.equal(plan.outboxMessage.topic, 'deletion-sync.purged');
});

test('buildRedditPointerCascadeTargets includes only the stages the caller supplies paths for', () => {
  const pointer = storedPointer();
  const targets = buildRedditPointerCascadeTargets(pointer, {
    quarantinePath: `submissionQuarantine/${pointer.id}`,
  });
  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.kind, 'quarantine');
});

test('sweepRedditPointerLiveness purges only the pointers a fresh liveness check finds dead, and applies real mutations', async () => {
  const alivePointer = storedPointer({ id: 'ptr_alive', postId: 'pc1abc' });
  const deadPointer = storedPointer({ id: 'ptr_dead', postId: 'bh1removed' });
  const actor = { id: 'system:reddit-deletion-sync', type: 'service' as const };

  const checker: RedditLivenessChecker = async (pointer) =>
    pointer.id === 'ptr_dead'
      ? {
          pointerId: pointer.id,
          checkedAt: FIXED_NOW,
          live: false,
          reason: 'removed_by_moderator_or_admin',
        }
      : { pointerId: pointer.id, checkedAt: FIXED_NOW, live: true, reason: 'live' };

  const outcomes = await sweepRedditPointerLiveness({
    pointers: [alivePointer, deadPointer],
    checkLiveness: checker,
    cascadePathsFor: (pointer) => ({
      quarantinePath: `submissionQuarantine/${pointer.id}`,
      graylistPath: `discoveryGraylist/${pointer.id}`,
    }),
    correlationIdFor: (pointer) => `corr_${pointer.id}`,
    requestedAt: FIXED_NOW,
    actor,
  });

  assert.equal(outcomes.length, 2);
  const aliveOutcome = outcomes.find((o) => o.pointerId === 'ptr_alive');
  const deadOutcome = outcomes.find((o) => o.pointerId === 'ptr_dead');
  assert.equal(aliveOutcome?.live, true);
  assert.equal(aliveOutcome?.purgePlan, undefined);
  assert.equal(deadOutcome?.live, false);
  assert.ok(deadOutcome?.purgePlan);

  const deleted: string[] = [];
  const store = { delete: (path: string) => deleted.push(path) };
  applyRedditPointerPurge(store, deadOutcome!.purgePlan!);
  assert.deepEqual(
    deleted.sort(),
    [`discoveryGraylist/${deadPointer.id}`, `submissionQuarantine/${deadPointer.id}`].sort(),
  );
});
