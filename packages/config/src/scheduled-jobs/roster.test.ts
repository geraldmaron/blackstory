
/**
 * The initial job roster registers cleanly, every entry declares owner
 * cadence budget timeout idempotency scheme kill switch target worker, and the
 * real-vs-stub split matches what this actually shipped.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertJobMayBeDispatched, listScheduledJobs } from './registry.ts';
import { DEFAULT_SCHEDULED_JOBS, createDefaultScheduledJobRegistry } from './roster.ts';

test('the default roster registers without throwing and every job dispatches by id', () => {
  const store = createDefaultScheduledJobRegistry();
  for (const job of DEFAULT_SCHEDULED_JOBS) {
    assert.deepEqual(assertJobMayBeDispatched(store, job.id), job);
  }
});

test('roster job ids are unique', () => {
  const ids = DEFAULT_SCHEDULED_JOBS.map((job) => job.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('exactly thirteen real job bodies are registered (prior nine plus four discovery campaigns)', () => {
  const store = createDefaultScheduledJobRegistry();
  const real = listScheduledJobs(store, { rosterStatus: 'real' }).map((job) => job.id).sort();
  assert.deepEqual(real, [
    'backup-verification-daily',
    'citation-link-health-sweep',
    'community-obscurity-discovery',
    'discovery-campaign-archive-dpla',
    'discovery-campaign-rss',
    'discovery-campaign-web-search',
    'discovery-campaign-wikimedia-federal',
    'gold-corpus-regression',
    'legal-change-monitoring',
    'reddit-deletion-sync',
    'relevance-confidence-recalibration-report',
    'restore-drill-quarterly',
    'source-drift-run-health-check',
  ]);
});

test('every stub declares which bead owns the real implementation', () => {
  const store = createDefaultScheduledJobRegistry();
  for (const job of listScheduledJobs(store, { rosterStatus: 'stub' })) {
    assert.ok(job.implementationOwnerBead, `${job.id} must declare implementationOwnerBead`);
  }
});

test('every job runs in the internal environment', () => {
  for (const job of DEFAULT_SCHEDULED_JOBS) {
    assert.equal(job.environment, 'repo-internal');
  }
});

test('only the two pre-approved jobs declare an automatic public-facing effect', () => {
  const withEffect = DEFAULT_SCHEDULED_JOBS.filter((job) => job.publicEffect !== 'none').map(
    (job) => [job.id, job.publicEffect],
  );
  assert.deepEqual(withEffect.sort(), [
    ['citation-link-health-sweep', 'link-repair-archived-copy'],
    ['release-coupled-rebuild', 'release-coupled-rebuild'],
  ]);
});

test('every job with a public-facing effect declares its own kill switch, distinct from every other job', () => {
  const killSwitchIds = DEFAULT_SCHEDULED_JOBS.map((job) => job.killSwitchId);
  const publicEffectJobs = DEFAULT_SCHEDULED_JOBS.filter((job) => job.publicEffect !== 'none');
  for (const job of publicEffectJobs) {
    assert.ok(job.killSwitchId.length > 0);
  }
  // research-campaigns is deliberately shared across discovery-campaign-* jobs; every other
  // switch id must be unique to its job.
  const nonSharedSwitchIds = killSwitchIds.filter((id) => id !== 'research-campaigns');
  assert.equal(new Set(nonSharedSwitchIds).size, nonSharedSwitchIds.length);
});

test('discovery-campaign jobs share the research-campaigns kill switch (exact workstream semantic fit)', () => {
  const discoveryJobs = DEFAULT_SCHEDULED_JOBS.filter((job) => job.id.startsWith('discovery-campaign-'));
  assert.ok(discoveryJobs.length >= 4);
  for (const job of discoveryJobs) {
    assert.equal(job.killSwitchId, 'research-campaigns');
  }
});

test('the roster covers every acceptance-criterion job family', () => {
  const ids = new Set(DEFAULT_SCHEDULED_JOBS.map((job) => job.id));
  const expectedFamilies = [
    'discovery-campaign-',
    'reddit-deletion-sync',
    'legal-change-monitoring',
    'citation-link-health-sweep',
    'external-dataset-refresh-',
    'relevance-confidence-recalibration-report',
    'source-drift-run-health-check',
    'gold-corpus-regression',
    'backup-verification-',
    'restore-drill-',
    'cost-budget-report',
  ];
  for (const family of expectedFamilies) {
    assert.ok(
      [...ids].some((id) => id === family || id.startsWith(family)),
      `expected a roster entry matching "${family}"`,
    );
  }
});
