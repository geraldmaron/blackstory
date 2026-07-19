
/**
 * /: proves the Reddit deletion-sync job body is REAL it calls
 * `@repo/domain`'s `sweepRedditPointerLiveness`/`applyRedditPointerPurge` (which in turn
 * wrap `planDeletionSyncPurge`/`applyDeletionSyncPurge`) rather than reimplementing
 * liveness classification or purge mechanics. Fixture/fake-driven throughout no live network.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RedditLivenessChecker, RedditStoredPointer } from '@repo/domain';
import { runRedditDeletionSyncJob } from './reddit-deletion-sync.ts';

const ACTOR = { id: 'system:reddit-deletion-sync', type: 'service' as const };

function pointer(overrides: Partial<RedditStoredPointer> = {}): RedditStoredPointer {
  return {
    id: 'ptr_1',
    stableIdentifier: 'reddit:sub_askhistorians:pc1abc',
    subredditRegistryId: 'sub_askhistorians',
    subreddit: 'AskHistorians',
    postId: 'pc1abc',
    permalink: 'https://www.reddit.com/r/AskHistorians/comments/pc1abc/example/',
    authorHandle: 'piedmont_researcher',
    capturedAt: '2026-07-15T00:00:00.000Z',
    snippet: 'Sources for a Freedmen’s Bureau field office in Piedmont County?',
    ...overrides,
  };
}

test('a sweep with no dead pointers completes as success and purges nothing', async () => {
  const checker: RedditLivenessChecker = async (p) => ({ pointerId: p.id, checkedAt: '2026-07-17T20:00:00.000Z', live: true, reason: 'live' });
  const deleted: string[] = [];
  const result = await runRedditDeletionSyncJob({
    jobRunId: 'run-1',
    startedAt: '2026-07-17T20:00:00.000Z',
    completedAt: '2026-07-17T20:01:00.000Z',
    pointers: [pointer()],
    checkLiveness: checker,
    cascadePathsFor: (p) => ({ quarantinePath: `submissionQuarantine/${p.id}` }),
    correlationIdFor: (p) => `corr_${p.id}`,
    actor: ACTOR,
    purgeStore: { delete: (path) => deleted.push(path) },
  });

  assert.equal(result.run.status, 'success');
  assert.equal(result.summary.checked, 1);
  assert.equal(result.summary.purged, 0);
  assert.equal(result.summary.stillLive, 1);
  assert.deepEqual(deleted, []);
});

test('a sweep with a dead pointer purges it through the real  purge mutation path', async () => {
  const alive = pointer({ id: 'ptr_alive' });
  const dead = pointer({ id: 'ptr_dead', postId: 'bh1removed' });
  const checker: RedditLivenessChecker = async (p) =>
    p.id === 'ptr_dead'
      ? { pointerId: p.id, checkedAt: '2026-07-17T20:00:00.000Z', live: false, reason: 'removed_by_moderator_or_admin' }
      : { pointerId: p.id, checkedAt: '2026-07-17T20:00:00.000Z', live: true, reason: 'live' };
  const deleted: string[] = [];

  const result = await runRedditDeletionSyncJob({
    jobRunId: 'run-2',
    startedAt: '2026-07-17T20:00:00.000Z',
    completedAt: '2026-07-17T20:01:00.000Z',
    pointers: [alive, dead],
    checkLiveness: checker,
    cascadePathsFor: (p) => ({ quarantinePath: `submissionQuarantine/${p.id}`, graylistPath: `discoveryGraylist/${p.id}` }),
    correlationIdFor: (p) => `corr_${p.id}`,
    actor: ACTOR,
    purgeStore: { delete: (path) => deleted.push(path) },
  });

  assert.equal(result.summary.checked, 2);
  assert.equal(result.summary.purged, 1);
  assert.equal(result.summary.stillLive, 1);
  assert.deepEqual(deleted.sort(), [`discoveryGraylist/${dead.id}`, `submissionQuarantine/${dead.id}`].sort());
  assert.equal(result.run.status, 'quarantined'); // completeJobRun marks any run with issues as quarantined, matching every other job body's convention.
  assert.ok(result.run.issues?.includes(`${dead.id}:purged`));
});
