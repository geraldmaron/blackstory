/**
 * Containment-chain materialization (BB-092 acceptance criterion 2).
 *
 * The owner's "anchor most things around state" rule: `located_at`/`part_of` chains
 * (spot -> city -> county -> state) are walked at projection build time into a single
 * denormalized containment path carrying BB-091 jurisdiction ids, computed once per
 * geo-anchored entity rather than re-derived per request. Lat/lng+radius stays the *rendering*
 * attribute (see `../geography/precision.ts`'s `displayRadiusMeters`); the containment path is
 * the *identity* attribute this module produces.
 *
 * Two composable layers, matching `../geography/jurisdiction-refs.ts`'s dependency-injected
 * resolver-port pattern (read, not modified, by this bead):
 *
 * 1. `resolveEntityContainmentPaths` walks the ENTITY graph across `located_at`/`part_of`
 *    `EntityRelationship` edges (spot -> city -> county -> state as separate CanonicalEntity
 *    records) and collects each hop's own BB-091 jurisdiction ids.
 * 2. `extendJurisdictionChain` optionally continues upward through the BB-091 jurisdiction
 *    registry's own `parentId` hierarchy (`Jurisdiction` from `../geography/location.js`) via an
 *    injected `JurisdictionParentLookup` port, for cases where the entity chain runs out before
 *    reaching `state` but the jurisdiction registry itself knows the rest of the ancestry.
 *
 * Both layers are pure, deterministic, cycle-safe (visited-set), and bounded-depth — safe to
 * re-run on every projection build (BB-019 discipline: derived-at-publish, never a live graph
 * traversal at request time).
 */
import type { Jurisdiction } from '../geography/location.js';
import type { RelationshipType } from '../relationship.js';

/** The two relationship types a containment chain is built from (see relationship.ts semantics). */
export const CONTAINMENT_RELATIONSHIP_TYPES = ['located_at', 'part_of'] as const;
export type ContainmentRelationshipType = (typeof CONTAINMENT_RELATIONSHIP_TYPES)[number];

export function isContainmentRelationshipType(
  type: RelationshipType,
): type is ContainmentRelationshipType {
  return (CONTAINMENT_RELATIONSHIP_TYPES as readonly RelationshipType[]).includes(type);
}

/** Bound on containment-chain hops: spot, city, county, state, country leaves ample headroom. */
export const MAX_CONTAINMENT_DEPTH = 8;

export type ContainmentEdgeInput = {
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly type: RelationshipType;
};

export type ContainmentEntityInput = {
  readonly entityId: string;
  /** BB-091 jurisdiction ids directly attached to this entity (EntityLocation.jurisdictionIds /
   * PlaceFields.jurisdictionIds), finest-tier-first when more than one. */
  readonly jurisdictionIds?: readonly string[];
};

export type ContainmentChainHop = {
  readonly entityId: string;
  readonly jurisdictionIds: readonly string[];
};

export type ContainmentPath = {
  readonly entityId: string;
  /** Ordered finest -> coarsest hop chain (the entity itself first). */
  readonly chain: readonly ContainmentChainHop[];
  /** Deduplicated union of every jurisdiction id across the chain, finest-first order preserved. */
  readonly jurisdictionIds: readonly string[];
  /** True when a `located_at`/`part_of` cycle was detected and traversal stopped safely. */
  readonly cycleDetected: boolean;
  /** True when `MAX_CONTAINMENT_DEPTH` was hit before the chain terminated. */
  readonly depthTruncated: boolean;
};

/**
 * Builds a deterministic `fromEntityId -> toEntityId` index restricted to containment edges
 * (`located_at`/`part_of`). When an entity has more than one outgoing containment edge (a
 * data-entry ambiguity), the target is chosen deterministically (lexicographically smallest
 * `toEntityId`) rather than arbitrarily by input order — required for the build to be
 * re-runnable and byte-identical across runs.
 */
export function buildContainmentIndex(
  edges: readonly ContainmentEdgeInput[],
): ReadonlyMap<string, string> {
  const candidates = new Map<string, string[]>();
  for (const edge of edges) {
    if (!isContainmentRelationshipType(edge.type)) continue;
    const existing = candidates.get(edge.fromEntityId) ?? [];
    existing.push(edge.toEntityId);
    candidates.set(edge.fromEntityId, existing);
  }
  const index = new Map<string, string>();
  for (const [fromEntityId, toEntityIds] of candidates) {
    index.set(fromEntityId, [...toEntityIds].sort()[0]!);
  }
  return index;
}

/**
 * Resolves the containment path for a single entity: walks `located_at`/`part_of` edges from
 * `entityId` outward (spot -> city -> county -> state), collecting each hop's own jurisdiction
 * ids. Cycle-safe (a visited set stops traversal the instant a hop repeats) and bounded-depth
 * (`MAX_CONTAINMENT_DEPTH`) so a malformed cyclic edge set can never hang the build.
 */
export function resolveEntityContainmentPath(
  entityId: string,
  containmentIndex: ReadonlyMap<string, string>,
  entitiesById: ReadonlyMap<string, ContainmentEntityInput>,
): ContainmentPath {
  const chain: ContainmentChainHop[] = [];
  const visited = new Set<string>();
  let cycleDetected = false;
  let depthTruncated = false;
  let current: string | undefined = entityId;

  while (current !== undefined) {
    if (visited.has(current)) {
      cycleDetected = true;
      break;
    }
    if (chain.length >= MAX_CONTAINMENT_DEPTH) {
      depthTruncated = true;
      break;
    }
    visited.add(current);
    chain.push({
      entityId: current,
      jurisdictionIds: entitiesById.get(current)?.jurisdictionIds ?? [],
    });
    current = containmentIndex.get(current);
  }

  const jurisdictionIds: string[] = [];
  const seenJurisdictions = new Set<string>();
  for (const hop of chain) {
    for (const jurisdictionId of hop.jurisdictionIds) {
      if (!seenJurisdictions.has(jurisdictionId)) {
        seenJurisdictions.add(jurisdictionId);
        jurisdictionIds.push(jurisdictionId);
      }
    }
  }

  return {
    entityId,
    chain,
    jurisdictionIds,
    cycleDetected,
    depthTruncated,
  };
}

/**
 * Resolves containment paths for every geo-anchored entity (BB-092 acceptance criterion 2: "on
 * every geo-anchored entity"). `geoAnchoredEntityIds` is the caller-supplied set of entities that
 * carry a location (EntityLocation row or a `place`/`school`/`institution`-kind
 * `jurisdictionIds`) — this module does not itself decide what counts as geo-anchored, matching
 * `buildMapSource`'s dependency-injection style (`../map/map-source.ts`).
 */
export function resolveEntityContainmentPaths(
  geoAnchoredEntityIds: readonly string[],
  entities: readonly ContainmentEntityInput[],
  edges: readonly ContainmentEdgeInput[],
): readonly ContainmentPath[] {
  const containmentIndex = buildContainmentIndex(edges);
  const entitiesById = new Map(entities.map((entity) => [entity.entityId, entity]));
  return [...geoAnchoredEntityIds]
    .sort()
    .map((entityId) => resolveEntityContainmentPath(entityId, containmentIndex, entitiesById));
}

// ---------------------------------------------------------------------------
// Layer 2: optional jurisdiction-registry hierarchy extension, following the
// `../geography/jurisdiction-refs.ts` resolver-port pattern.
// ---------------------------------------------------------------------------

/** Minimal read port a projection build supplies; a real implementation is Firestore-backed
 * against the BB-091 `jurisdictions` collection. Mirrors `JurisdictionResolver`'s shape in
 * `../geography/jurisdiction-refs.ts` (sync-or-async, structurally typed, no import needed). */
export type JurisdictionParentLookup = {
  parentOf(jurisdictionId: string): Promise<string | undefined> | string | undefined;
};

/** In-memory lookup built from already-loaded `Jurisdiction` rows — for tests and small builds,
 * the same role `createInMemoryJurisdictionResolver` plays for the BB-091 gate. */
export function createInMemoryJurisdictionParentLookup(
  jurisdictions: readonly Pick<Jurisdiction, 'id' | 'parentId'>[],
): JurisdictionParentLookup {
  const parents = new Map(jurisdictions.map((j) => [j.id, j.parentId]));
  return {
    parentOf(jurisdictionId: string) {
      return parents.get(jurisdictionId);
    },
  };
}

export type ExtendJurisdictionChainResult = {
  readonly jurisdictionIds: readonly string[];
  readonly cycleDetected: boolean;
  readonly depthTruncated: boolean;
};

/**
 * Extends an already-resolved jurisdiction id list upward through the BB-091 jurisdiction
 * registry's own `parentId` hierarchy, for cases where the entity containment chain (layer 1)
 * runs out before reaching `state` but the jurisdiction registry itself knows the rest of the
 * ancestry (e.g. a `city` jurisdiction id whose `county`/`state` ancestors are registry data, not
 * separate CanonicalEntity records). Cycle-safe and bounded-depth like layer 1; never mutates the
 * input, always returns a new deduplicated, finest-first list.
 */
export async function extendJurisdictionChain(
  jurisdictionIds: readonly string[],
  lookup: JurisdictionParentLookup,
): Promise<ExtendJurisdictionChainResult> {
  const result: string[] = [];
  const resultSeen = new Set<string>();
  let cycleDetected = false;
  let depthTruncated = false;

  for (const startId of jurisdictionIds) {
    // Per-chain visited set: cycle detection must not fire merely because two different
    // starting ids share a common ancestor (a normal, non-cyclic case).
    const walkSeen = new Set<string>();
    let current: string | undefined = startId;
    let depth = 0;
    while (current !== undefined) {
      if (walkSeen.has(current)) {
        cycleDetected = true;
        break;
      }
      walkSeen.add(current);
      if (!resultSeen.has(current)) {
        resultSeen.add(current);
        result.push(current);
      }
      if (depth >= MAX_CONTAINMENT_DEPTH) {
        depthTruncated = true;
        break;
      }
      current = await lookup.parentOf(current);
      depth += 1;
    }
  }

  return { jurisdictionIds: result, cycleDetected, depthTruncated };
}
