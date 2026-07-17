/**
 * History graph substrate (BB-092): containment-chain materialization, derived per-entity
 * adjacency / per-decade / all-time release views, succession-chain non-leakage, and BB-086
 * FactRecord `subjects[]` mirroring. See each module's own doc comment for the acceptance
 * criterion it satisfies. Edge-vocabulary types/guardrails live in `../relationship.ts` (this
 * bead extends that file in place rather than duplicating its exports here).
 */
export {
  CONTAINMENT_RELATIONSHIP_TYPES,
  isContainmentRelationshipType,
  MAX_CONTAINMENT_DEPTH,
  buildContainmentIndex,
  resolveEntityContainmentPath,
  resolveEntityContainmentPaths,
  createInMemoryJurisdictionParentLookup,
  extendJurisdictionChain,
} from './containment.js';
export type {
  ContainmentRelationshipType,
  ContainmentEdgeInput,
  ContainmentEntityInput,
  ContainmentChainHop,
  ContainmentPath,
  JurisdictionParentLookup,
  ExtendJurisdictionChainResult,
} from './containment.js';

export { mirrorFactSubjectsIntoRelationships } from './fact-subjects.js';
export type {
  FactSubjectRef,
  FactSubjectSource,
  MirroredFactSubjectRelationship,
} from './fact-subjects.js';

export {
  DEFAULT_ADJACENCY_CAP,
  buildEntityAdjacency,
  buildAllEntityAdjacency,
  toPublicRelatedEntries,
} from './adjacency.js';
export type {
  AdjacencyDirection,
  PublicRelatedEntry,
  AdjacencyEntry,
  EntityAdjacency,
  BuildEntityAdjacencyOptions,
} from './adjacency.js';

export { deriveActiveDecadeBuckets, buildDecadeViews, buildAllTimeView } from './decades.js';
export type {
  DecadeBucketEntityInput,
  DeriveActiveDecadeBucketsOptions,
  DecadeGraphView,
  BuildDecadeViewsInput,
  AllTimeGraphView,
} from './decades.js';

export {
  resolveSuccessionEndpoints,
  buildSuccessionLinkedContext,
  buildSuccessorPublicView,
} from './succession.js';
export type { SuccessionEdge, LinkedHistoricalContextEntry, SuccessorPublicView } from './succession.js';

export {
  publicGraphAdjacencyPath,
  publicGraphDecadePath,
  publicGraphAllTimePath,
  buildGraphReleaseArtifact,
  assertGraphReleaseArtifactReproducible,
  publicRelatedEntriesByEntityId,
} from './build.js';
export type { GraphReleaseArtifactInput, GraphReleaseArtifact } from './build.js';

// Gold-corpus-style regression fixtures (BB-092 acceptance criterion 6) — internal-facing like
// ../map/fixtures.js's re-export here (see ../map/index.ts): NOT re-exported from the top-level
// packages/domain/src/index.ts barrel, only from this subsystem index, for this package's own
// test suite to import.
export { GRAPH_GOLD_FIXTURES } from './fixtures.js';
