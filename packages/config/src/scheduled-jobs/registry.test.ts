
/**
 * No unregistered recurring job can run, and every field the registry
 * requires (owner, cadence, budget, timeout, idempotency scheme, kill switch, target worker) is
 * actually validated at register-time.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ScheduledJobNotRegisteredError,
  assertJobMayBeDispatched,
  createInMemoryScheduledJobRegistry,
  getScheduledJob,
  listScheduledJobs,
  registerScheduledJob,
  requireScheduledJob,
} from './registry.ts';
import type { ScheduledJobDefinition } from './types.ts';

function validJob(overrides: Partial<ScheduledJobDefinition> = {}): ScheduledJobDefinition {
  return {
    id: 'sample-job',
    owner: 'BB-084',
    description: 'A sample job for registry tests.',
    cadence: { cronExpression: '0 4 * * *', nominalIntervalMs: 86_400_000, humanReadable: 'daily' },
    budget: { unit: 'items', maxPerRun: 10 },
    timeoutSec: 600,
    idempotencyKeyScheme: 'job:{jobId}:{dayStart}',
    killSwitchId: 'research-campaigns',
    targetWorker: { package: 'research', function: 'sample.run' },
    environment: 'blackbook-internal',
    publicEffect: 'none',
    rosterStatus: 'real',
    consecutiveMissedRunThreshold: 2,
    ...overrides,
  };
}

test('an unregistered job id is rejected — no unregistered recurring job can run', () => {
  const store = createInMemoryScheduledJobRegistry();
  assert.equal(getScheduledJob(store, 'never-registered'), undefined);
  assert.throws(() => requireScheduledJob(store, 'never-registered'), ScheduledJobNotRegisteredError);
  assert.throws(() => assertJobMayBeDispatched(store, 'never-registered'), ScheduledJobNotRegisteredError);
});

test('a registered job dispatches by id and round-trips its fields', () => {
  const store = createInMemoryScheduledJobRegistry();
  const job = validJob();
  registerScheduledJob(store, job);
  const dispatched = assertJobMayBeDispatched(store, job.id);
  assert.deepEqual(dispatched, job);
  assert.deepEqual(listScheduledJobs(store), [job]);
});

test('registering the same job id twice fails', () => {
  const store = createInMemoryScheduledJobRegistry();
  registerScheduledJob(store, validJob());
  assert.throws(() => registerScheduledJob(store, validJob()));
});

test('rejects an invalid cron expression', () => {
  const store = createInMemoryScheduledJobRegistry();
  assert.throws(() =>
    registerScheduledJob(
      store,
      validJob({ cadence: { cronExpression: 'not a cron', nominalIntervalMs: 1000, humanReadable: 'bad' } }),
    ),
  );
});

test('rejects a non-positive budget', () => {
  const store = createInMemoryScheduledJobRegistry();
  assert.throws(() =>
    registerScheduledJob(store, validJob({ budget: { unit: 'items', maxPerRun: 0 } })),
  );
});

test('rejects a timeout out of range', () => {
  const store = createInMemoryScheduledJobRegistry();
  assert.throws(() => registerScheduledJob(store, validJob({ timeoutSec: 0 })));
  assert.throws(() => registerScheduledJob(store, validJob({ timeoutSec: 999_999 })));
});

test('rejects an idempotency key scheme missing {jobId} or a time-window token', () => {
  const store = createInMemoryScheduledJobRegistry();
  assert.throws(() => registerScheduledJob(store, validJob({ idempotencyKeyScheme: 'no-tokens-here' })));
  assert.throws(() => registerScheduledJob(store, validJob({ idempotencyKeyScheme: 'job:{jobId}' })));
});

test('rejects a target worker package outside research/publication/security (ADR-007)', () => {
  const store = createInMemoryScheduledJobRegistry();
  assert.throws(() =>
    registerScheduledJob(
      store,
      // @ts-expect-error deliberately invalid for the test
      validJob({ targetWorker: { package: 'notifications', function: 'run' } }),
    ),
  );
});

test('rejects a publicEffect outside the two pre-approved exceptions', () => {
  const store = createInMemoryScheduledJobRegistry();
  assert.throws(() =>
    registerScheduledJob(
      store,
      // @ts-expect-error deliberately invalid for the test
      validJob({ publicEffect: 'auto-publish-everything' }),
    ),
  );
});

test('a stub job must declare its implementation-owner bead', () => {
  const store = createInMemoryScheduledJobRegistry();
  assert.throws(() => registerScheduledJob(store, validJob({ rosterStatus: 'stub' })));
  assert.doesNotThrow(() =>
    registerScheduledJob(store, validJob({ rosterStatus: 'stub', implementationOwnerBead: 'BB-999' })),
  );
});

test('rejects a non-positive consecutiveMissedRunThreshold', () => {
  const store = createInMemoryScheduledJobRegistry();
  assert.throws(() => registerScheduledJob(store, validJob({ consecutiveMissedRunThreshold: 0 })));
});

test('listScheduledJobs filters by owner, rosterStatus, and target worker package', () => {
  const store = createInMemoryScheduledJobRegistry();
  registerScheduledJob(store, validJob({ id: 'job-a', owner: 'BB-001', rosterStatus: 'real' }));
  registerScheduledJob(
    store,
    validJob({
      id: 'job-b',
      owner: 'BB-002',
      rosterStatus: 'stub',
      implementationOwnerBead: 'BB-002',
      targetWorker: { package: 'security', function: 'run' },
    }),
  );
  assert.deepEqual(
    listScheduledJobs(store, { owner: 'BB-001' }).map((j) => j.id),
    ['job-a'],
  );
  assert.deepEqual(
    listScheduledJobs(store, { rosterStatus: 'stub' }).map((j) => j.id),
    ['job-b'],
  );
  assert.deepEqual(
    listScheduledJobs(store, { targetWorkerPackage: 'security' }).map((j) => j.id),
    ['job-b'],
  );
});
