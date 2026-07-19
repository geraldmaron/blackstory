import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertVerificationPolicyValid,
  addReviewInterval,
  resolveVerificationPolicy,
  reviewIntervalToMs,
  type VerificationPolicy,
} from './policy.js';

function policy(overrides: Partial<VerificationPolicy> = {}): VerificationPolicy {
  return {
    id: 'policy-1',
    appliesToEntityClasses: ['person'],
    appliesToPredicates: ['vital_status'],
    volatilityClass: 'high',
    defaultReviewInterval: { unit: 'month', count: 1 },
    authoritativeSourceIds: ['source-obits'],
    contradictionSearchRequired: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('reviewIntervalToMs converts each unit and rejects non-positive counts', () => {
  assert.equal(reviewIntervalToMs({ unit: 'day', count: 1 }), 24 * 60 * 60 * 1000);
  assert.equal(reviewIntervalToMs({ unit: 'week', count: 2 }), 2 * 7 * 24 * 60 * 60 * 1000);
  assert.throws(() => reviewIntervalToMs({ unit: 'month', count: 0 }));
  assert.throws(() => reviewIntervalToMs({ unit: 'year', count: -1 }));
});

test('addReviewInterval advances an ISO timestamp by the interval', () => {
  const next = addReviewInterval('2026-01-01T00:00:00.000Z', { unit: 'day', count: 10 });
  assert.equal(next, '2026-01-11T00:00:00.000Z');
});

test('assertVerificationPolicyValid rejects empty scope and unknown volatility class', () => {
  assert.throws(() => assertVerificationPolicyValid(policy({ appliesToEntityClasses: [] })));
  assert.throws(() => assertVerificationPolicyValid(policy({ appliesToPredicates: [] })));
  assert.throws(() =>
    assertVerificationPolicyValid(policy({ volatilityClass: 'extreme' as never })),
  );
  assert.doesNotThrow(() => assertVerificationPolicyValid(policy()));
});

test('resolveVerificationPolicy matches on entityClass + predicate', () => {
  const legalPolicy = policy({
    id: 'legal-case-status',
    appliesToEntityClasses: ['legal'],
    appliesToPredicates: ['case_status'],
  });
  const personPolicy = policy();
  const resolved = resolveVerificationPolicy([personPolicy, legalPolicy], {
    entityClass: 'legal',
    predicate: 'case_status',
  });
  assert.equal(resolved?.id, 'legal-case-status');
});

test('resolveVerificationPolicy returns undefined when nothing matches', () => {
  const resolved = resolveVerificationPolicy([policy()], {
    entityClass: 'place',
    predicate: 'demolished',
  });
  assert.equal(resolved, undefined);
});

test('resolveVerificationPolicy breaks ties by preferring the narrower predicate scope', () => {
  const broad = policy({
    id: 'broad-person-policy',
    appliesToPredicates: ['vital_status', 'current_office', 'employer'],
  });
  const narrow = policy({ id: 'narrow-vital-status-policy', appliesToPredicates: ['vital_status'] });
  const resolved = resolveVerificationPolicy([broad, narrow], {
    entityClass: 'person',
    predicate: 'vital_status',
  });
  assert.equal(resolved?.id, 'narrow-vital-status-policy');
});
