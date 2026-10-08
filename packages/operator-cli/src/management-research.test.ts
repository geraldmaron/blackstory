import assert from 'node:assert/strict';
import test from 'node:test';
import { validateExecutionPlan } from '@repo/research-kernel';
import type { WorkItem } from '@repo/ops-data/management/contracts';
import { managedResearchPlan } from './management-research.js';

test('managed research reserves every bounded retry within the standard budget', () => {
  const work: WorkItem = {
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: 'owner',
    request: {
      request: 'Research Lincoln, Atlanta and Wilmington schools',
      sessionId: 'phone',
      harness: 'test',
      idempotencyKey: 'request',
    },
    state: 'researching',
    version: 0,
    proposal: null,
    proposalHash: null,
    approvedEntityIds: [],
    outcome: null,
    error: null,
    dispatchStatus: 'accepted',
    createdAt: '2026-10-08T12:00:00.000Z',
    updatedAt: '2026-10-08T12:00:00.000Z',
  };
  const plan = managedResearchPlan(work, 'configured/model', []);
  assert.doesNotThrow(() => validateExecutionPlan(plan));
  const overBudget = { ...plan, tasks: plan.tasks.map((task) => ({ ...task, maxAttempts: 3 })) };
  assert.throws(() => validateExecutionPlan(overBudget), /budget/i);
  assert.equal(plan.tasks[0]!.input.request, work.request.request);
  assert.deepEqual(plan.profile.modelPolicies[0]!.authority, ['proposal']);
});
