import assert from 'node:assert/strict';
import test from 'node:test';
import { validateExecutionPlan } from '@repo/research-kernel';
import type { WorkItem } from '@repo/ops-data/management/contracts';
import { managedResearchPlan, retainedManagementSource } from './management-research.js';

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

test('new-source retention is exact, private, bounded and fails closed', () => {
  const candidate = {
    sourceUrl: 'https://records.example.gov/school',
    excerpt: 'A factual passage.',
    context: 'Published school history.',
    contentHash: 'a'.repeat(64),
    title: 'School record',
  };
  const review = {
    sourceUrl: candidate.sourceUrl,
    allowExcerptRetention: true,
    sensitivity: 'public',
    basis:
      'Published factual school history; necessary short quotation for private verification, not a substitute for the source; no sensitive personal information in this passage.',
  };
  assert.equal(
    retainedManagementSource(candidate, { ...review, sourceUrl: 'https://other.example/school' }),
    null,
  );
  assert.equal(retainedManagementSource(candidate, { ...review, sensitivity: 'unknown' }), null);
  assert.equal(
    retainedManagementSource(candidate, { ...review, allowExcerptRetention: false }),
    null,
  );
  assert.equal(retainedManagementSource(candidate, { ...review, basis: '.gov is trusted' }), null);
  assert.equal(retainedManagementSource({ ...candidate, excerpt: 'x'.repeat(1001) }, review), null);
  assert.equal(retainedManagementSource({ ...candidate, excerpt: ' ' }, review), null);
  const source = retainedManagementSource(candidate, review, new Date('2026-10-08T00:00:00Z'))!;
  assert.equal(source.rawRecord.preservationDecision.allowArchive, false);
  assert.equal(source.rawRecord.preservationDecision.expiresAt, '2026-11-07T00:00:00.000Z');
  assert.equal(source.description, candidate.excerpt);
  assert.match(source.rawRecord.preservationDecision.basis, /not a license/);
});
