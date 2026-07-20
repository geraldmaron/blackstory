/**
 * Verifies edge intake lands proposed EntityRelationship claims
 * in the same real quarantine pipeline every other operator-cli proposal uses never a
 * parallel writer and that the caused/enabled consensus-causation guardrail (acceptance
 * criterion 9) is enforced BEFORE quarantine, not left to submitter judgment.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareEdgeIntake, type EdgeIntakeInput } from './edge-intake.ts';
import type { OperatorIntakeContext } from './intake.ts';

const IDENTITY = {
  operatorId: 'operator-gerald',
  sessionId: 'session-2026-07-17-01',
  source: 'claude_session' as const,
};

function context(overrides: Partial<OperatorIntakeContext> = {}): OperatorIntakeContext {
  return {
    identity: IDENTITY,
    privacyPepper: 'test-only-pepper',
    nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
    ...overrides,
  };
}

function baseInput(overrides: Partial<EdgeIntakeInput> = {}): EdgeIntakeInput {
  return {
    fromEntityId: 'ent-person-organizer',
    toEntityId: 'ent-event-rally',
    type: 'attended',
    sourceUrls: ['https://archive.example.org/rally-1963'],
    ...overrides,
  };
}

test('proposing an attended edge with a role lands in the real quarantine pipeline and opens a draft research case — no parallel writer', () => {
  const outcome = prepareEdgeIntake(
    baseInput({ role: 'organizer', temporal: { validFrom: '1963' } }),
    context(),
  );
  assert.equal(outcome.accepted, true);
  if (!outcome.accepted) return;
  assert.equal(outcome.proposalKind, 'lead');
  assert.equal(outcome.submission.destination, 'submission_quarantine');
  assert.equal(outcome.submission.canonicalWriteAllowed, false);
  assert.ok(outcome.researchCase, 'edge proposals open a draft research case for review');
  for (const mutation of outcome.mutations) {
    assert.ok(
      mutation.path.startsWith('submissionInbox/') || mutation.path.startsWith('researchCases/'),
      `edge intake must never write outside quarantine/researchCases (got ${mutation.path})`,
    );
  }
});

test('an unrecognized relationship type is rejected before quarantine', () => {
  assert.throws(
    () => prepareEdgeIntake(baseInput({ type: 'not_a_real_type' as never }), context()),
    /Unrecognized relationship type/,
  );
});

test('a role on a non-attended type is rejected before quarantine', () => {
  assert.throws(
    () =>
      prepareEdgeIntake(
        baseInput({ type: 'founded', role: 'organizer', temporal: undefined }),
        context(),
      ),
    /only valid on "attended"/,
  );
});

test('a causal historical-causation type missing TemporalContext.validFrom is rejected before quarantine', () => {
  assert.throws(
    () =>
      prepareEdgeIntake(
        baseInput({
          type: 'caused',
          causalReview: { scope: 'systemic_consensus', consensusBasis: 'x' },
        }),
        context(),
      ),
    /requires a TemporalContext/,
  );
});

test('acceptance criterion 9: a caused/enabled edge with NO causalReview is rejected (silence defaults to rejection, not permissiveness)', () => {
  const outcome = () =>
    prepareEdgeIntake(baseInput({ type: 'enabled', temporal: { validFrom: '1964' } }), context());
  assert.throws(outcome, /reserved for consensus, citable systemic historical causation/);
});

test('acceptance criterion 9: a contested/single-incident caused/enabled claim is rejected and points to cites', () => {
  assert.throws(
    () =>
      prepareEdgeIntake(
        baseInput({
          type: 'enabled',
          temporal: { validFrom: '1964' },
          causalReview: { scope: 'contested_or_single_incident' },
        }),
        context(),
      ),
    /use the "cites" edge instead/,
  );
});

test('acceptance criterion 9: a settled systemic-causation claim with a documented basis is accepted and proceeds to quarantine', () => {
  const outcome = prepareEdgeIntake(
    baseInput({
      fromEntityId: 'ent-policy-exclusionary-lending',
      toEntityId: 'ent-place-disinvested-district',
      type: 'caused',
      temporal: { validFrom: '1935', validTo: '1968' },
      causalReview: {
        scope: 'systemic_consensus',
        consensusBasis: 'Documented across multiple peer-reviewed secondary sources.',
      },
    }),
    context(),
  );
  assert.equal(outcome.accepted, true);
});

test('non-causal types (e.g. commemorates, participated_in) are never gated by the causal guardrail', () => {
  const outcome = prepareEdgeIntake(
    baseInput({
      type: 'commemorates',
      fromEntityId: 'ent-place-modern-city',
      toEntityId: 'ent-event-rally',
    }),
    context(),
  );
  assert.equal(outcome.accepted, true);
});
