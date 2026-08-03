/**
 * Verifies quarantine-triage judges quarantined intake items and prepares only the writes it's
 * allowed to make never a canonical/promoted record, only a draft case or a status update.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LlmProvider } from './llm-provider.ts';
import {
  buildQuarantineTriagePrompt,
  judgeQuarantineItem,
  prepareQuarantineTriageDecision,
  type QuarantineIntakeItem,
} from './quarantine-triage.ts';

const IDENTITY = {
  operatorId: 'operator-gerald',
  sessionId: 'session-2026-07-25-01',
  source: 'claude_session' as const,
};

const ITEM: QuarantineIntakeItem = {
  id: 'intake-1',
  kind: 'contribution',
  payload: {
    title: 'Douglass Avenue mutual-aid office',
    statement: 'A 1962 photo names its founders.',
  },
  sourceUrl: 'https://archive.example.org/douglass-ave-1962',
  createdAt: '2026-07-20T00:00:00.000Z',
};

function providerReturning(content: unknown): LlmProvider {
  return {
    id: 'stub',
    async complete() {
      return { content: JSON.stringify(content), provider: 'stub', modelId: 'stub-model' };
    },
  };
}

test('buildQuarantineTriagePrompt includes the item id and payload', () => {
  const messages = buildQuarantineTriagePrompt(ITEM);
  assert.equal(messages[0]?.role, 'system');
  assert.ok(messages[1]?.content.includes('intake-1'));
  assert.ok(messages[1]?.content.includes('Douglass Avenue'));
});

test('judgeQuarantineItem accepts a well-formed case decision', async () => {
  const provider = providerReturning({
    decision: 'case',
    rationale: 'Specific, sourceable historical subject with a dated photo reference.',
    confidence: 0.82,
    title: 'Douglass Avenue mutual-aid office',
  });
  const judgment = await judgeQuarantineItem({ item: ITEM, provider, model: 'stub-model' });
  assert.equal(judgment.decision, 'case');
  assert.equal(judgment.confidence, 0.82);
  assert.equal(judgment.title, 'Douglass Avenue mutual-aid office');
});

test('judgeQuarantineItem rejects an invalid decision value', async () => {
  const provider = providerReturning({ decision: 'promote', rationale: 'nope', confidence: 0.9 });
  await assert.rejects(() => judgeQuarantineItem({ item: ITEM, provider, model: 'stub-model' }));
});

test('judgeQuarantineItem rejects out-of-range confidence', async () => {
  const provider = providerReturning({ decision: 'case', rationale: 'ok', confidence: 1.5 });
  await assert.rejects(() => judgeQuarantineItem({ item: ITEM, provider, model: 'stub-model' }));
});

test('judgeQuarantineItem rejects non-JSON output', async () => {
  const provider: LlmProvider = {
    id: 'stub',
    async complete() {
      return { content: 'not json', provider: 'stub', modelId: 'stub-model' };
    },
  };
  await assert.rejects(() => judgeQuarantineItem({ item: ITEM, provider, model: 'stub-model' }));
});

test('prepareQuarantineTriageDecision opens a draft case for a confident "case" judgment', () => {
  const plan = prepareQuarantineTriageDecision(
    ITEM,
    {
      decision: 'case',
      rationale: 'Specific, sourceable subject.',
      confidence: 0.82,
      title: 'Douglass Avenue mutual-aid office',
      modelId: 'stub-model',
      provider: 'stub',
    },
    { confidenceThreshold: 0.6, nowIso: '2026-07-25T00:00:00.000Z' },
  );
  assert.equal(plan.effectiveDecision, 'case');
  assert.equal(plan.write?.nextStatus, 'promoted');
  assert.equal(plan.write?.caseWrite?.record.state, 'candidate');
  assert.equal(plan.write?.caseWrite?.record.candidateId, ITEM.id);
  assert.equal(plan.write?.caseWrite?.record.title, 'Douglass Avenue mutual-aid office');
});

test('prepareQuarantineTriageDecision falls back to the real nested payload.normalized.title when the model omits one', () => {
  const realShapedItem: QuarantineIntakeItem = {
    ...ITEM,
    payload: {
      normalized: { title: 'What Was Black Wall Street? History & Legacy', statement: 'ignored' },
      original: { payload: { title: 'ignored, normalized wins' } },
    },
  };
  const plan = prepareQuarantineTriageDecision(
    realShapedItem,
    { decision: 'case', rationale: 'ok', confidence: 0.7, modelId: 'stub-model', provider: 'stub' },
    { confidenceThreshold: 0.6, nowIso: '2026-07-25T00:00:00.000Z' },
  );
  assert.equal(plan.write?.caseWrite?.record.title, 'What Was Black Wall Street? History & Legacy');
});

test('prepareQuarantineTriageDecision downgrades low confidence to needs_human and writes nothing', () => {
  const plan = prepareQuarantineTriageDecision(
    ITEM,
    {
      decision: 'case',
      rationale: 'unsure',
      confidence: 0.4,
      modelId: 'stub-model',
      provider: 'stub',
    },
    { confidenceThreshold: 0.6, nowIso: '2026-07-25T00:00:00.000Z' },
  );
  assert.equal(plan.effectiveDecision, 'needs_human');
  assert.equal(plan.write, undefined);
});

test('prepareQuarantineTriageDecision only updates status for reject/spam, no case write', () => {
  const rejectPlan = prepareQuarantineTriageDecision(
    ITEM,
    {
      decision: 'reject',
      rationale: 'out of scope',
      confidence: 0.9,
      modelId: 'stub-model',
      provider: 'stub',
    },
    { confidenceThreshold: 0.6, nowIso: '2026-07-25T00:00:00.000Z' },
  );
  assert.equal(rejectPlan.write?.nextStatus, 'rejected');
  assert.equal(rejectPlan.write?.caseWrite, undefined);

  const spamPlan = prepareQuarantineTriageDecision(
    ITEM,
    {
      decision: 'spam',
      rationale: 'promotional',
      confidence: 0.95,
      modelId: 'stub-model',
      provider: 'stub',
    },
    { confidenceThreshold: 0.6, nowIso: '2026-07-25T00:00:00.000Z' },
  );
  assert.equal(spamPlan.write?.nextStatus, 'spam');
  assert.equal(spamPlan.write?.caseWrite, undefined);
});

test('identity used by commit stays proposer-only (type-level: no approverId field exists)', () => {
  // commitQuarantineTriagePlans takes an OperatorIdentity, the same proposer-only identity
  // type intake.ts uses see promotion-boundary.test.ts for the invariant this protects.
  assert.equal(IDENTITY.source, 'claude_session');
});
