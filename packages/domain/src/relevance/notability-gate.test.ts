/**
 * Tests for the notability-basis publish gate and the standing-policy hard rule
 * that numeric scores never appear in a public entity payload.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentEntityStatus, type CanonicalEntity } from '../entity.js';
import { deriveEraBuckets } from '../era.js';
import { NOTABILITY_RUBRIC } from '../entity-status.js';
import {
  assertPublishableEntityHasNotabilityBasis,
  evaluateNotabilityGate,
} from './notability-gate.js';
import { RELEVANCE_GATE_IDS } from './types.js';

const NOW = '2026-07-17T00:00:00.000Z';

test('notability_basis extends the 7 discovery-time gates to 8, never replacing them', () => {
  assert.equal(RELEVANCE_GATE_IDS.length, 8);
  assert.deepEqual(RELEVANCE_GATE_IDS.slice(0, 7), [
    'signal_present',
    'weak_signal_independent',
    'negative_only',
    'threshold',
    'distinctiveness',
    'duplicate',
    'include_evidence',
  ]);
  assert.equal(RELEVANCE_GATE_IDS[7], 'notability_basis');
});

test('evaluateNotabilityGate fails for zero basis records and passes for >=1', () => {
  const empty = evaluateNotabilityGate(undefined);
  assert.equal(empty.gateId, 'notability_basis');
  assert.equal(empty.passed, false);

  const zero = evaluateNotabilityGate([]);
  assert.equal(zero.passed, false);

  const one = evaluateNotabilityGate([
    { criterion: 'first_to_do_x', note: 'Documented first.', evidenceIds: ['ev-1'] },
  ]);
  assert.equal(one.passed, true);
});

test('the projection build fails closed on a publishable entity with zero basis entries', () => {
  assert.throws(
    () => assertPublishableEntityHasNotabilityBasis({ id: 'entity-without-basis' }),
    /cannot publish/,
  );
  assert.throws(
    () =>
      assertPublishableEntityHasNotabilityBasis({
        id: 'entity-empty-basis',
        notabilityBasis: [],
      }),
    /cannot publish/,
  );
  assert.doesNotThrow(() =>
    assertPublishableEntityHasNotabilityBasis({
      id: 'entity-with-basis',
      notabilityBasis: [
        {
          criterion: 'landmark_or_national_register',
          note: 'Listed on the National Register of Historic Places.',
          evidenceIds: ['ev-nrhp-1'],
        },
      ],
    }),
  );
});

function assertNoNumericLeaf(value: unknown, path = '$'): void {
  if (typeof value === 'number') {
    throw new Error(`Numeric value found in public payload at ${path}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoNumericLeaf(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertNoNumericLeaf(entry, `${path}.${key}`);
    }
  }
}

/** Standing policy hard rule: numeric notability/relevance scores are banned from public
 * payloads. A public entity payload is status (string) + eraBuckets (string) + notability
 * criterion labels (string) + sensitivity class (string) every one non-numeric. */
test('public entity payload never exposes a numeric notability, status, or relevance score', () => {
  const entity: CanonicalEntity = {
    id: 'ent-law-notable-1',
    kind: 'law',
    displayName: 'Example Civil Rights Statute',
    statusHistory: [
      { status: 'in_force', validFrom: '1964', datePrecision: 'year', basisClaimIds: ['claim-1'] },
    ],
    notabilityBasis: [
      {
        criterion: 'court_precedent',
        note: "Set binding precedent for enforcement of Black Americans' civil rights.",
        evidenceIds: ['ev-1'],
      },
    ],
    sensitivity: [
      {
        class: 'contested_legacy',
        note: 'Legislative history includes contested compromise provisions.',
        basisClaimIds: ['claim-2'],
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };

  const publicEntityPayload = {
    id: entity.id,
    kind: entity.kind,
    displayName: entity.displayName,
    status: currentEntityStatus(entity),
    eraBuckets: deriveEraBuckets({ validFrom: '1964', datePrecision: 'year' }),
    notabilityLabels: entity.notabilityBasis?.map((basis) => NOTABILITY_RUBRIC[basis.criterion]),
    sensitivityClass: entity.sensitivity?.[0]?.class,
  };

  assertNoNumericLeaf(publicEntityPayload);

  const serialized = JSON.stringify(publicEntityPayload);
  for (const bannedField of ['score', 'notabilityScore', 'compositeScore', 'relevanceScore']) {
    assert.equal(
      serialized.toLowerCase().includes(bannedField.toLowerCase()),
      false,
      `public entity payload must never mention "${bannedField}"`,
    );
  }
});
