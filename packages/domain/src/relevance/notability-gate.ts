/**
 * Notability-basis publish gate (BB-090 AC3) — extends, never replaces, the 7 discovery-time
 * relevance gates in ./gates.ts.
 *
 * The discovery-time gates in `runRelevanceGates` (./gates.ts) run over a
 * `DiscoveryCandidateRecord` *before* a canonical entity exists, so they cannot see
 * `notabilityBasis` (curated later, during entity/claim review). This gate instead runs at
 * entity-publish time over the entity's own `notabilityBasis[]` (../entity-status.ts). It shares
 * the same `RelevanceGateId` / `RelevanceGateResult` vocabulary (./types.ts) so "why is X in"
 * tooling can treat all 8 gates uniformly.
 *
 * Wiring note: the actual projection/release build that must call
 * `assertPublishableEntityHasNotabilityBasis` before including an entity in a release lives in
 * `packages/domain/src/publication/` — outside this bead's file-ownership boundary. That call
 * site is a documented integration point (see ADR-015 Consequences), not wired live here.
 */
import type { NotabilityBasisRecord } from '../entity-status.js';
import type { RelevanceGateResult } from './types.js';

/** Evaluate the notability-basis gate for a candidate-for-publication entity. */
export function evaluateNotabilityGate(
  notabilityBasis: readonly NotabilityBasisRecord[] | undefined,
): RelevanceGateResult {
  const count = notabilityBasis?.length ?? 0;
  const passed = count >= 1;
  return {
    gateId: 'notability_basis',
    passed,
    reason: passed
      ? `Entity has ${count} documented notability basis record(s).`
      : 'Publishable entity has zero notabilityBasis records — at least one auditable inclusion basis is required to publish.',
  };
}

/**
 * Fails closed: throws when a publishable entity has zero `notabilityBasis` records (BB-090
 * AC3). Callers (the projection/release build — see the wiring note above) should invoke this
 * before including an entity in a release.
 */
export function assertPublishableEntityHasNotabilityBasis(entity: {
  readonly id: string;
  readonly notabilityBasis?: readonly NotabilityBasisRecord[];
}): void {
  const gateResult = evaluateNotabilityGate(entity.notabilityBasis);
  if (!gateResult.passed) {
    throw new Error(`Entity ${entity.id} cannot publish: ${gateResult.reason}`);
  }
}
