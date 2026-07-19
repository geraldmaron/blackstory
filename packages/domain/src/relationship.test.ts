/**
 * Tests for the EntityRelationship vocabulary extensions: historical-causation edges,
 * `authored`, the `attended` role qualifier, documented direction/temporal semantics, the causal
 * TemporalContext requirement, and the caused/enabled consensus-causation
 * guardrail.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertCausalEdgeGuardrail,
  assertRelationshipHasEvidence,
  assertRelationshipRoleValidForType,
  assertRelationshipTemporalRequirement,
  CAUSAL_ASSERTION_RELATIONSHIP_TYPES,
  CAUSAL_HISTORICAL_RELATIONSHIP_TYPES,
  evaluateCausalEdgeGuardrail,
  isCausalAssertionRelationshipType,
  RELATIONSHIP_ROLES,
  RELATIONSHIP_TYPE_SEMANTICS,
  RELATIONSHIP_TYPES,
  relationshipRequiresTemporalContext,
  type EntityRelationship,
} from './relationship.js';

const BASE: Pick<
  EntityRelationship,
  'id' | 'fromEntityId' | 'toEntityId' | 'evidenceIds' | 'createdAt' | 'updatedAt'
> = {
  id: 'rel-1',
  fromEntityId: 'ent-a',
  toEntityId: 'ent-b',
  evidenceIds: ['ev-1'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// vocabulary extension + documented direction/temporal semantics.
// ---------------------------------------------------------------------------

test('RELATIONSHIP_TYPES carries the full vocabulary extension', () => {
  for (const type of [
    'caused',
    'enabled',
    'influenced',
    'participated_in',
    'overturned',
    'commemorates',
    'authored',
  ]) {
    assert.ok(
      (RELATIONSHIP_TYPES as readonly string[]).includes(type),
      `expected RELATIONSHIP_TYPES to include "${type}"`,
    );
  }
  // Pre-existing types remain untouched.
  for (const type of ['located_at', 'attended', 'founded', 'part_of', 'successor_of', 'cites']) {
    assert.ok((RELATIONSHIP_TYPES as readonly string[]).includes(type));
  }
});

test('every RelationshipType has a documented direction and temporal-semantics entry', () => {
  for (const type of RELATIONSHIP_TYPES) {
    const semantics = RELATIONSHIP_TYPE_SEMANTICS[type];
    assert.ok(semantics, `missing semantics entry for "${type}"`);
    assert.ok(semantics.direction.length > 0);
    assert.ok(semantics.temporalSemantics.length > 0);
    assert.equal(typeof semantics.requiresTemporalContext, 'boolean');
  }
});

test('authored is documented as distinct from founded (creation attribution vs org/institution founding)', () => {
  assert.match(RELATIONSHIP_TYPE_SEMANTICS.authored.direction, /publication\/artifact/);
  assert.match(RELATIONSHIP_TYPE_SEMANTICS.founded.direction, /Reserved for/);
});

test('assertRelationshipHasEvidence still holds for every edge type, new and pre-existing', () => {
  for (const type of RELATIONSHIP_TYPES) {
    assert.throws(() => assertRelationshipHasEvidence({ evidenceIds: [] }));
    assert.doesNotThrow(() => assertRelationshipHasEvidence({ evidenceIds: ['ev-1'] }));
    void type;
  }
});

// ---------------------------------------------------------------------------
// causal edges require a TemporalContext.
// ---------------------------------------------------------------------------

test('CAUSAL_HISTORICAL_RELATIONSHIP_TYPES requires TemporalContext for caused/enabled/influenced/overturned', () => {
  assert.deepEqual(
    [...CAUSAL_HISTORICAL_RELATIONSHIP_TYPES].sort(),
    ['caused', 'enabled', 'influenced', 'overturned'].sort(),
  );
  for (const type of CAUSAL_HISTORICAL_RELATIONSHIP_TYPES) {
    assert.equal(relationshipRequiresTemporalContext(type), true);
  }
});

test('assertRelationshipTemporalRequirement rejects a causal edge with no TemporalContext', () => {
  assert.throws(
    () => assertRelationshipTemporalRequirement({ type: 'caused' }),
    /requires a TemporalContext/,
  );
  assert.throws(() =>
    assertRelationshipTemporalRequirement({ type: 'enabled', temporal: { label: 'no dates' } }),
  );
});

test('assertRelationshipTemporalRequirement accepts a causal edge with validFrom', () => {
  assert.doesNotThrow(() =>
    assertRelationshipTemporalRequirement({ type: 'caused', temporal: { validFrom: '1935' } }),
  );
});

test('assertRelationshipTemporalRequirement does not require TemporalContext for non-causal types', () => {
  assert.doesNotThrow(() => assertRelationshipTemporalRequirement({ type: 'attended' }));
  assert.doesNotThrow(() => assertRelationshipTemporalRequirement({ type: 'commemorates' }));
});

// ---------------------------------------------------------------------------
// attended role qualifier.
// ---------------------------------------------------------------------------

test('RELATIONSHIP_ROLES carries organizer|speaker|participant', () => {
  assert.deepEqual(RELATIONSHIP_ROLES, ['organizer', 'speaker', 'participant']);
});

test('assertRelationshipRoleValidForType accepts a role on attended', () => {
  assert.doesNotThrow(() =>
    assertRelationshipRoleValidForType({ type: 'attended', role: 'organizer' }),
  );
  assert.doesNotThrow(() => assertRelationshipRoleValidForType({ type: 'attended' }));
});

test('assertRelationshipRoleValidForType rejects a role on any non-attended type', () => {
  assert.throws(
    () => assertRelationshipRoleValidForType({ type: 'founded', role: 'organizer' }),
    /only valid on "attended"/,
  );
  assert.throws(() => assertRelationshipRoleValidForType({ type: 'caused', role: 'speaker' }));
});

test('a full attended EntityRelationship with role and evidence is well-formed', () => {
  const rel: EntityRelationship = {
    ...BASE,
    type: 'attended',
    role: 'organizer',
    temporal: { validFrom: '1963-08-28' },
  };
  assert.doesNotThrow(() => assertRelationshipHasEvidence(rel));
  assert.doesNotThrow(() => assertRelationshipRoleValidForType(rel));
  assert.doesNotThrow(() => assertRelationshipTemporalRequirement(rel));
});

// ---------------------------------------------------------------------------
// caused/enabled consensus-causation guardrail. Proves the
// distinction is enforced, not merely commented: a contested/single-incident causal claim is
// rejected and routed to `cites`; a settled systemic claim with a documented basis is allowed.
// ---------------------------------------------------------------------------

test('CAUSAL_ASSERTION_RELATIONSHIP_TYPES is exactly caused and enabled', () => {
  assert.deepEqual([...CAUSAL_ASSERTION_RELATIONSHIP_TYPES].sort(), ['caused', 'enabled']);
  assert.equal(isCausalAssertionRelationshipType('caused'), true);
  assert.equal(isCausalAssertionRelationshipType('enabled'), true);
  assert.equal(isCausalAssertionRelationshipType('influenced'), false);
  assert.equal(isCausalAssertionRelationshipType('cites'), false);
});

test('guardrail ALLOWS the settled-systemic-causation case (HOLC-redlining-shaped claim)', () => {
  const result = evaluateCausalEdgeGuardrail('caused', {
    scope: 'systemic_consensus',
    consensusBasis:
      'Multiple peer-reviewed secondary sources document this lending policy causing measurable, ' +
      'geographically consistent disinvestment across redlined districts.',
  });
  assert.deepEqual(result, { allowed: true });
  assert.doesNotThrow(() =>
    assertCausalEdgeGuardrail('caused', {
      scope: 'systemic_consensus',
      consensusBasis: 'Documented secondary-source consensus.',
    }),
  );
});

test('guardrail REJECTS a contested/single-incident causal claim (statute-enabled-a-specific-killing shape)', () => {
  const result = evaluateCausalEdgeGuardrail('enabled', {
    scope: 'contested_or_single_incident',
  });
  assert.equal(result.allowed, false);
  if (result.allowed) throw new Error('unreachable');
  assert.equal(result.suggestedType, 'cites');
  assert.match(result.reason, /reserved for consensus, citable systemic historical causation/);
  assert.throws(
    () => assertCausalEdgeGuardrail('enabled', { scope: 'contested_or_single_incident' }),
    /reserved for consensus/,
  );
});

test('guardrail REJECTS a systemic_consensus claim missing a documented consensus basis', () => {
  const result = evaluateCausalEdgeGuardrail('caused', { scope: 'systemic_consensus' });
  assert.equal(result.allowed, false);
  if (result.allowed) throw new Error('unreachable');
  assert.equal(result.suggestedType, 'cites');
  assert.match(result.reason, /requires a documented consensus/);

  const blank = evaluateCausalEdgeGuardrail('caused', {
    scope: 'systemic_consensus',
    consensusBasis: '   ',
  });
  assert.equal(blank.allowed, false);
});

test('guardrail is a no-op (always allowed) for every non-caused/enabled type, including the other five additions', () => {
  const nonCausalTypes = RELATIONSHIP_TYPES.filter((t) => !isCausalAssertionRelationshipType(t));
  for (const type of nonCausalTypes) {
    assert.deepEqual(evaluateCausalEdgeGuardrail(type, { scope: 'contested_or_single_incident' }), {
      allowed: true,
    });
  }
});

test('guardrail distinction is exercised end-to-end: two claims about the same predicate, different scope, different outcome', () => {
  // Same edge type ("enabled"), same entities the ONLY difference is the reviewed scope. This
  // is the exact distinction requires: a specific statute "enabling" a
  // specific act of violence (contested/single-incident) must be rejected, while a documented
  // systemic policy enabling a measurable, consensus-recognized outcome is allowed.
  const contestedSingleIncident = evaluateCausalEdgeGuardrail('enabled', {
    scope: 'contested_or_single_incident',
  });
  const settledSystemic = evaluateCausalEdgeGuardrail('enabled', {
    scope: 'systemic_consensus',
    consensusBasis:
      'Documented in multiple peer-reviewed histories as a systemic, non-contested enabling condition.',
  });
  assert.equal(contestedSingleIncident.allowed, false);
  assert.equal(settledSystemic.allowed, true);
});
