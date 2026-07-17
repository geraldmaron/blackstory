/**
 * Succession-chain non-leakage (BB-092 acceptance criterion 11 — CRITICAL).
 *
 * When a `successor_of` edge links a superseded historical entity (the predecessor) to its
 * modern successor, the predecessor's own `statusHistory`/condition designation must NEVER leak
 * onto the successor as the successor's current status. The canonical case from the bead text: a
 * historical place is annexed or renamed — the historical entity keeps its own `historic`/closed
 * statusHistory, and the modern successor keeps its own, independently-derived current status
 * (e.g. `active`). Querying the successor via `successor_of` surfaces the predecessor's
 * designation only as LINKED HISTORICAL CONTEXT, never merged into or overwriting the successor's
 * own status.
 *
 * Structural guardrail, not a runtime check alone: this module has NO function that reads or
 * writes an entity's `status`/`statusHistory` field directly (that stays BB-090's
 * `currentEntityStatus`/`currentStatus`/`statusAsOf`, imported read-only, never reimplemented
 * here). It only builds a separate, clearly-labeled "linked historical context" view from the
 * predecessor's own statusHistory — a caller who wants the successor's current status must call
 * BB-090's own status derivation against the successor's OWN entity record, which this module
 * never touches. See `./succession.test.ts` for the explicit non-leakage proof against the
 * place-annexation scenario.
 */
import type { EntityStatusValue, StatusHistoryEntry } from '../entity-status.js';
import type { EntityRelationship } from '../relationship.js';

export type SuccessionEdge = Pick<EntityRelationship, 'type' | 'fromEntityId' | 'toEntityId'>;

/**
 * Resolves which endpoint is the modern successor and which is the superseded historical
 * predecessor, per `successor_of`'s documented direction in `../relationship.ts`
 * (`RELATIONSHIP_TYPE_SEMANTICS.successor_of`): `fromEntityId` is the successor, `toEntityId` is
 * the predecessor. Throws on any other edge type — this module only ever operates on
 * `successor_of` edges.
 */
export function resolveSuccessionEndpoints(
  edge: SuccessionEdge,
): { readonly successorEntityId: string; readonly predecessorEntityId: string } {
  if (edge.type !== 'successor_of') {
    throw new Error(
      `resolveSuccessionEndpoints requires a "successor_of" edge (got type "${edge.type}")`,
    );
  }
  return { successorEntityId: edge.fromEntityId, predecessorEntityId: edge.toEntityId };
}

export type LinkedHistoricalContextEntry = {
  readonly predecessorEntityId: string;
  readonly designation: EntityStatusValue;
  readonly validFrom?: string;
  readonly validTo?: string | null;
  /** Fixed explanatory copy so this can never be mistaken for the successor's own status when
   * rendered — deliberately repeats "predecessor" and "not the successor's current status". */
  readonly note: string;
};

const LINKED_CONTEXT_NOTE =
  'Historical designation of the superseded predecessor entity — linked context only; this is ' +
  'never the successor entity\'s current status.';

/**
 * Builds the "linked historical context" view for a `successor_of` edge: every one of the
 * predecessor's OWN `statusHistory` entries, relabeled as historical context tied to
 * `predecessorEntityId`. This is the ONLY function in this module that reads a statusHistory
 * array, and it only ever reads the PREDECESSOR's — never the successor's. Nothing here computes
 * or returns a "current status" for either entity.
 */
export function buildSuccessionLinkedContext(
  edge: SuccessionEdge,
  predecessorStatusHistory: readonly StatusHistoryEntry<EntityStatusValue>[] | undefined,
): readonly LinkedHistoricalContextEntry[] {
  const { predecessorEntityId } = resolveSuccessionEndpoints(edge);
  return (predecessorStatusHistory ?? []).map((entry) => ({
    predecessorEntityId,
    designation: entry.status,
    ...(entry.validFrom !== undefined ? { validFrom: entry.validFrom } : {}),
    ...(entry.validTo !== undefined ? { validTo: entry.validTo } : {}),
    note: LINKED_CONTEXT_NOTE,
  }));
}

/**
 * Builds the combined public view for an entity that is the successor side of one or more
 * `successor_of` edges: its own related-entry (built by the caller, typically via
 * `../graph/adjacency.ts`) is left completely untouched, and every predecessor's linked
 * historical context is attached under a clearly separate `linkedHistoricalContext` key. This is
 * the shape a public entity projection should merge in — proof that the two never collapse into
 * one `status` field lives in `./succession.test.ts`.
 */
export type SuccessorPublicView = {
  readonly successorEntityId: string;
  readonly linkedHistoricalContext: readonly LinkedHistoricalContextEntry[];
};

export function buildSuccessorPublicView(
  successorEntityId: string,
  edges: readonly SuccessionEdge[],
  predecessorStatusHistoryById: ReadonlyMap<
    string,
    readonly StatusHistoryEntry<EntityStatusValue>[] | undefined
  >,
): SuccessorPublicView {
  const linkedHistoricalContext: LinkedHistoricalContextEntry[] = [];
  for (const edge of edges) {
    const { successorEntityId: edgeSuccessorId, predecessorEntityId } =
      resolveSuccessionEndpoints(edge);
    if (edgeSuccessorId !== successorEntityId) continue;
    linkedHistoricalContext.push(
      ...buildSuccessionLinkedContext(edge, predecessorStatusHistoryById.get(predecessorEntityId)),
    );
  }
  return { successorEntityId, linkedHistoricalContext };
}
