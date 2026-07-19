/**
 * Safe selection restoration for Explore (MOB-012), mirroring MOB-008's
 * `parseRestoredRoute` pattern (`app/_lib/route-params.ts`).
 *
 * A selected entity is shareable/restorable via the `selected` query param (the
 * same mechanism a deep link uses), so on cold start the previously-selected
 * entity is validated through `parseEntityId` (T4 charset/length defense) AND
 * reconciled against the CURRENT active-release population. If the entity was
 * withdrawn or released-out between sessions its id no longer appears among the
 * available features, and restoration falls back to "no selection" gracefully —
 * it never hands a stale id to the entity route or crashes. This is the Explore
 * analogue of ADR-004/MOB-005 release-stamp invalidation at the selection layer.
 */
import { parseEntityId } from '@/app/_lib/route-params';
import type { ExploreFeature } from './explore-feature';

export type RestoredSelection = {
  /** The id to restore, or undefined when there is nothing safe to restore. */
  readonly selectedId?: string;
  /** Why restoration produced no selection — for observability/tests, never shown raw. */
  readonly reason?: 'none' | 'invalid-id' | 'withdrawn';
};

/**
 * Validates a persisted/deep-linked selection against the available features.
 * Returns `{ selectedId }` only when the id is well-formed AND still present.
 */
export function parseRestoredSelection(
  rawSelected: unknown,
  available: readonly ExploreFeature[],
): RestoredSelection {
  const id = parseEntityId(rawSelected);
  if (id === null) return { reason: rawSelected == null ? 'none' : 'invalid-id' };
  const exists = available.some((feature) => feature.entityId === id);
  if (!exists) return { reason: 'withdrawn' };
  return { selectedId: id };
}

/**
 * Reconciles an in-memory selection against a (possibly newer) feature set: if the
 * selected entity has disappeared (release change / withdrawal), the selection is
 * dropped. Used when the active release swaps under a live screen.
 */
export function reconcileSelection(
  selectedId: string | undefined,
  available: readonly ExploreFeature[],
): string | undefined {
  if (selectedId === undefined) return undefined;
  return available.some((feature) => feature.entityId === selectedId) ? selectedId : undefined;
}
