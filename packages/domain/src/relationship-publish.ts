/**
 * Publish invariants for `EntityRelationship` (BB the related workstream).
 *
 * These validators encode the review's publish requirements as small, composable, testable
 * functions. None of them are wired into a publish pipeline yet that wiring belongs to the
 * release-builder bead (the related workstream). Each function here takes the narrowest input it needs
 * (via `Pick`) so callers can validate against partial data without constructing a full
 * `EntityRelationship`.
 */
import { assertRelationshipHasEvidence, assertRelationshipTemporalRequirement } from './relationship.js';
import type { EntityRelationship } from './relationship.js';

// ---------------------------------------------------------------------------
// endpoint resolution.
// ---------------------------------------------------------------------------

/** A published relationship must have both endpoint entities resolved to canonical entities,
 * not left pointing at unresolved discovery candidates. */
export function assertRelationshipEndpointsResolvedForPublish(
  rel: Pick<EntityRelationship, 'resolutionState'>,
): void {
  if (rel.resolutionState !== 'resolved') {
    throw new Error(
      `Relationship endpoints must both be resolved before publication ` +
        `(resolutionState="${rel.resolutionState ?? 'undefined'}").`,
    );
  }
}

// ---------------------------------------------------------------------------
// self-corroboration guard.
// An edge cannot be its own sole corroboration: when graph corroboration for a relationship is
// assembled from other relationship ids, the edge under evaluation must never appear among its
// own corroborating set, and that set must not be empty-after-self-exclusion when corroboration
// is being asserted as present.
// ---------------------------------------------------------------------------

export type SelfCorroborationCheck = {
  readonly relationshipId: string;
  readonly corroboratingRelationshipIds: readonly string[];
};

/** Removes self-references from a proposed corroboration set. Pure; never throws. */
export function excludeSelfFromCorroboration(
  input: SelfCorroborationCheck,
): readonly string[] {
  return input.corroboratingRelationshipIds.filter((id) => id !== input.relationshipId);
}

/** Fails closed: throws if the relationship's own id is offered as part of its corroborating
 * set (a data/logic bug upstream), and throws if, after removing any such self-reference, no
 * independent corroboration remains but the caller is asserting corroboration is required. */
export function assertRelationshipNotSoleSelfCorroboration(
  input: SelfCorroborationCheck & { readonly corroborationRequired: boolean },
): void {
  if (input.corroboratingRelationshipIds.includes(input.relationshipId)) {
    throw new Error(
      `Relationship "${input.relationshipId}" cannot appear in its own corroborating set.`,
    );
  }
  const independent = excludeSelfFromCorroboration(input);
  if (input.corroborationRequired && independent.length === 0) {
    throw new Error(
      `Relationship "${input.relationshipId}" has no independent corroboration ` +
        `(a relationship can never be its own sole corroboration).`,
    );
  }
}

// ---------------------------------------------------------------------------
// syndicated evidence dedupe.
// Mirrors the claims confidence engine's `uniqueLineageAggregates` principle
// (see `./claims/confidence.ts`): copies sharing a lineage root count once, not per copy.
// ---------------------------------------------------------------------------

export type EvidenceLineageLookup = Readonly<Record<string, string>>;

/**
 * Counts unique independent lineages among `evidenceIds`. An evidence id missing from
 * `lineageRootByEvidenceId` is treated as its own, unshared lineage root (fails open to
 * "independent" rather than silently dropping unmapped evidence from the count).
 */
export function countUniqueSyndicatedEvidenceLineages(
  evidenceIds: readonly string[],
  lineageRootByEvidenceId: EvidenceLineageLookup,
): number {
  const roots = new Set(evidenceIds.map((id) => lineageRootByEvidenceId[id] ?? id));
  return roots.size;
}

// ---------------------------------------------------------------------------
// aggregate publish-invariant check.
// ---------------------------------------------------------------------------

export type RelationshipPublishInvariantInput = {
  readonly relationship: Pick<
    EntityRelationship,
    'id' | 'type' | 'evidenceIds' | 'temporal' | 'resolutionState'
  >;
  /** Other relationship ids offered as graph corroboration for this one, if any. */
  readonly corroboratingRelationshipIds?: readonly string[];
  /** Whether independent graph corroboration is required for this publish check. Defaults to
   * `false` corroboration is a strengthening signal, not (yet) a hard requirement for every
   * relationship type; callers that do require it should pass `true`. */
  readonly corroborationRequired?: boolean;
};

/**
 * Runs every publish invariant from the review: evidence present, both endpoints resolved,
 * type-specific temporal requirements satisfied, and the edge is not its own sole
 * corroboration. Throws on the first violation. Does not itself perform syndication dedupe
 * counting callers that need `independentLineageCount` should compute it via
 * `countUniqueSyndicatedEvidenceLineages` before calling this.
 */
export function assertRelationshipPublishInvariants(input: RelationshipPublishInvariantInput): void {
  assertRelationshipHasEvidence(input.relationship);
  assertRelationshipEndpointsResolvedForPublish(input.relationship);
  assertRelationshipTemporalRequirement(input.relationship);
  assertRelationshipNotSoleSelfCorroboration({
    relationshipId: input.relationship.id,
    corroboratingRelationshipIds: input.corroboratingRelationshipIds ?? [],
    corroborationRequired: input.corroborationRequired ?? false,
  });
}
