/**
 * Tests for the EntityRelationship publish invariants (BB the related workstream): evidence presence,
 * endpoint resolution, type-specific temporal requirements, the edge-cannot-corroborate-itself
 * guard, and syndicated-evidence dedupe. Not wired into a publish pipeline yet (release-builder
 * bead the related workstream owns that); these tests exercise the validators directly.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertRelationshipEndpointsResolvedForPublish,
  assertRelationshipNotSoleSelfCorroboration,
  assertRelationshipPublishInvariants,
  countUniqueSyndicatedEvidenceLineages,
  excludeSelfFromCorroboration,
} from './relationship-publish.js';

const BASE_RELATIONSHIP = {
  id: 'rel-1',
  type: 'located_at' as const,
  evidenceIds: ['ev-1'],
  resolutionState: 'resolved' as const,
};

// ---------------------------------------------------------------------------
// endpoint resolution.
// ---------------------------------------------------------------------------

test('assertRelationshipEndpointsResolvedForPublish accepts "resolved"', () => {
  assert.doesNotThrow(() => assertRelationshipEndpointsResolvedForPublish({ resolutionState: 'resolved' }));
});

test('assertRelationshipEndpointsResolvedForPublish rejects unresolved/partial/undefined', () => {
  assert.throws(
    () => assertRelationshipEndpointsResolvedForPublish({ resolutionState: 'unresolved' }),
    /must both be resolved/,
  );
  assert.throws(() => assertRelationshipEndpointsResolvedForPublish({ resolutionState: 'partially_resolved' }));
  assert.throws(() => assertRelationshipEndpointsResolvedForPublish({}));
});

// ---------------------------------------------------------------------------
// self-corroboration guard.
// ---------------------------------------------------------------------------

test('excludeSelfFromCorroboration drops the relationship\'s own id', () => {
  const result = excludeSelfFromCorroboration({
    relationshipId: 'rel-1',
    corroboratingRelationshipIds: ['rel-1', 'rel-2', 'rel-3'],
  });
  assert.deepEqual(result, ['rel-2', 'rel-3']);
});

test('assertRelationshipNotSoleSelfCorroboration throws when the edge appears in its own corroborating set', () => {
  assert.throws(
    () =>
      assertRelationshipNotSoleSelfCorroboration({
        relationshipId: 'rel-1',
        corroboratingRelationshipIds: ['rel-1'],
        corroborationRequired: false,
      }),
    /cannot appear in its own corroborating set/,
  );
});

test('assertRelationshipNotSoleSelfCorroboration throws when corroboration is required but none remains after self-exclusion', () => {
  assert.throws(
    () =>
      assertRelationshipNotSoleSelfCorroboration({
        relationshipId: 'rel-1',
        corroboratingRelationshipIds: [],
        corroborationRequired: true,
      }),
    /no independent corroboration/,
  );
});

test('assertRelationshipNotSoleSelfCorroboration passes with independent corroboration present', () => {
  assert.doesNotThrow(() =>
    assertRelationshipNotSoleSelfCorroboration({
      relationshipId: 'rel-1',
      corroboratingRelationshipIds: ['rel-2'],
      corroborationRequired: true,
    }),
  );
});

test('assertRelationshipNotSoleSelfCorroboration does not require corroboration by default', () => {
  assert.doesNotThrow(() =>
    assertRelationshipNotSoleSelfCorroboration({
      relationshipId: 'rel-1',
      corroboratingRelationshipIds: [],
      corroborationRequired: false,
    }),
  );
});

// ---------------------------------------------------------------------------
// syndicated evidence dedupe.
// ---------------------------------------------------------------------------

test('countUniqueSyndicatedEvidenceLineages counts syndicated copies once', () => {
  const count = countUniqueSyndicatedEvidenceLineages(['ev-1', 'ev-2', 'ev-3'], {
    'ev-1': 'root-a',
    'ev-2': 'root-a',
    'ev-3': 'root-b',
  });
  assert.equal(count, 2);
});

test('countUniqueSyndicatedEvidenceLineages treats unmapped evidence ids as their own lineage root', () => {
  const count = countUniqueSyndicatedEvidenceLineages(['ev-1', 'ev-2'], {});
  assert.equal(count, 2);
});

test('countUniqueSyndicatedEvidenceLineages returns 0 for no evidence', () => {
  assert.equal(countUniqueSyndicatedEvidenceLineages([], {}), 0);
});

// ---------------------------------------------------------------------------
// aggregate publish-invariant check.
// ---------------------------------------------------------------------------

test('assertRelationshipPublishInvariants passes a fully-formed, resolved, evidenced relationship', () => {
  assert.doesNotThrow(() =>
    assertRelationshipPublishInvariants({
      relationship: BASE_RELATIONSHIP,
    }),
  );
});

test('assertRelationshipPublishInvariants rejects missing evidence', () => {
  assert.throws(
    () =>
      assertRelationshipPublishInvariants({
        relationship: { ...BASE_RELATIONSHIP, evidenceIds: [] },
      }),
    /at least one evidence id/,
  );
});

test('assertRelationshipPublishInvariants rejects unresolved endpoints', () => {
  assert.throws(
    () =>
      assertRelationshipPublishInvariants({
        relationship: { ...BASE_RELATIONSHIP, resolutionState: 'unresolved' },
      }),
    /must both be resolved/,
  );
});

test('assertRelationshipPublishInvariants rejects a causal edge missing its required TemporalContext', () => {
  assert.throws(
    () =>
      assertRelationshipPublishInvariants({
        relationship: { ...BASE_RELATIONSHIP, type: 'caused' },
      }),
    /requires a TemporalContext/,
  );
});

test('assertRelationshipPublishInvariants accepts a causal edge with validFrom', () => {
  assert.doesNotThrow(() =>
    assertRelationshipPublishInvariants({
      relationship: { ...BASE_RELATIONSHIP, type: 'caused', temporal: { validFrom: '1935' } },
    }),
  );
});

test('assertRelationshipPublishInvariants rejects an edge offered as its own corroboration', () => {
  assert.throws(
    () =>
      assertRelationshipPublishInvariants({
        relationship: BASE_RELATIONSHIP,
        corroboratingRelationshipIds: ['rel-1'],
      }),
    /cannot appear in its own corroborating set/,
  );
});

test('assertRelationshipPublishInvariants rejects required corroboration with none independent', () => {
  assert.throws(
    () =>
      assertRelationshipPublishInvariants({
        relationship: BASE_RELATIONSHIP,
        corroboratingRelationshipIds: [],
        corroborationRequired: true,
      }),
    /no independent corroboration/,
  );
});
