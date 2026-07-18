/**
 * Entity relationships with evidence and temporal/geographic context.
 *
 * Vocabulary includes historical-causation edges (`caused`, `enabled`, `influenced`,
 * `participated_in`, `overturned`, `commemorates`), a creation-attribution edge (`authored`,
 * distinct from `founded`), and an optional `role` qualifier on `attended`. See
 * `RELATIONSHIP_TYPE_SEMANTICS` below for the documented direction/temporal semantics every
 * type carries, `assertRelationshipTemporalRequirement` for the causal-edge TemporalContext
 * requirement, and `evaluateCausalEdgeGuardrail` / `assertCausalEdgeGuardrail` for the
 * `caused`/`enabled` consensus-causation intake guardrail. Graph-view materialization
 * (per-entity adjacency, per-decade views, all-time union, containment chains) lives in
 * `./graph/` and consumes `EntityRelationship` read-only — see `./graph/index.ts`.
 */
import type { ConfidenceScore } from './claims/confidence.js';

export const RELATIONSHIP_TYPES = [
  'located_at',
  'occurred_at',
  'attended',
  'founded',
  'employed_by',
  'member_of',
  'related_to',
  'depicts',
  'cites',
  'governed_by',
  'part_of',
  'successor_of',
  // historical-causation edges.
  'caused',
  'enabled',
  'influenced',
  'participated_in',
  'overturned',
  'commemorates',
  // stress-test amendment: creation attribution, distinct from `founded` (orgs/institutions only).
  'authored',
  'other',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/**
 * Role qualifier on the `attended` edge distinguishing
 * organizing/speaking weight from rank-and-file attendance without minting a new edge type.
 * Meaningless (and rejected by `assertRelationshipRoleValidForType`) on any other edge type.
 */
export const RELATIONSHIP_ROLES = ['organizer', 'speaker', 'participant'] as const;
export type RelationshipRole = (typeof RELATIONSHIP_ROLES)[number];

export type TemporalContext = {
  readonly label?: string;
  readonly validFrom?: string;
  readonly validTo?: string | null;
};

export type GeographicRelationshipContext = {
  readonly locationId?: string;
  readonly jurisdictionId?: string;
  readonly notes?: string;
};

// ---------------------------------------------------------------------------
// lifecycle/workflow vocabulary.
// Naming mirrors `ClaimWorkflowStatus`/`ClaimPublicationStatus` (see `./claims/claim.ts`) for
// cross-domain consistency, with one deliberate difference: relationships add an explicit
// `candidate` workflow state so a not-yet-reviewed graph edge (see BB `black-book-hx8j`) can be
// represented directly on `EntityRelationship` via `workflowStatus: 'candidate'` rather than
// requiring a separate `CandidateRelationship` type (see note on `createdFromCandidateId` below).
// ---------------------------------------------------------------------------

export const RELATIONSHIP_WORKFLOW_STATUSES = ['candidate', 'in_review', 'accepted', 'rejected'] as const;
export type RelationshipWorkflowStatus = (typeof RELATIONSHIP_WORKFLOW_STATUSES)[number];

export function isRelationshipWorkflowStatus(value: string): value is RelationshipWorkflowStatus {
  return (RELATIONSHIP_WORKFLOW_STATUSES as readonly string[]).includes(value);
}

/** Same vocabulary as `ClaimPublicationStatus` (see `./claims/claim.ts`) so a relationship's
 * publication lifecycle reads identically to a claim's. */
export const RELATIONSHIP_PUBLICATION_STATUSES = ['unpublished', 'published', 'retracted'] as const;
export type RelationshipPublicationStatus = (typeof RELATIONSHIP_PUBLICATION_STATUSES)[number];

export function isRelationshipPublicationStatus(value: string): value is RelationshipPublicationStatus {
  return (RELATIONSHIP_PUBLICATION_STATUSES as readonly string[]).includes(value);
}

/**
 * How well both endpoint entities (`fromEntityId`/`toEntityId`) are resolved to canonical
 * entities rather than still-pending discovery candidates. Distinct from
 * `./resolution/types.ts`'s `ResolutionOutcome` (`proposed_match`/`review_required`/`no_match`),
 * which describes a single candidate-to-entity match decision `resolutionState` here
 * describes the joint resolution state of an edge's *two* endpoints, which is a different
 * (relationship-shaped) question no existing enum answers directly.
 */
export const RELATIONSHIP_RESOLUTION_STATES = ['unresolved', 'partially_resolved', 'resolved'] as const;
export type RelationshipResolutionState = (typeof RELATIONSHIP_RESOLUTION_STATES)[number];

export function isRelationshipResolutionState(value: string): value is RelationshipResolutionState {
  return (RELATIONSHIP_RESOLUTION_STATES as readonly string[]).includes(value);
}

export type EntityRelationship = {
  readonly id: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly type: RelationshipType;
  /** Evidence record ids supporting this relationship. Required for
   * every relationship type, new and pre-existing alike see `assertRelationshipHasEvidence`. */
  readonly evidenceIds: readonly string[];
  readonly temporal?: TemporalContext;
  readonly geographic?: GeographicRelationshipContext;
  /** Only meaningful on `type: 'attended'` see `assertRelationshipRoleValidForType`. */
  readonly role?: RelationshipRole;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  // -------------------------------------------------------------------------
  // lifecycle/workflow fields (BB black-book-hx8j). All optional so pre-existing relationships
  // that never went through a candidate -> review -> published pipeline remain valid values
  // without a backfill migration; `assertRelationshipPublishInvariants`
  // (see `./relationship-publish.ts`) is where these become required for publication.
  // -------------------------------------------------------------------------
  /** Candidate -> in_review -> accepted|rejected pipeline state. Absent means legacy data
   * predating this field; treat as equivalent to `'accepted'` for read paths. */
  readonly workflowStatus?: RelationshipWorkflowStatus;
  readonly publicationStatus?: RelationshipPublicationStatus;
  /** Reuses the claims confidence result shape (`ConfidenceScore` from `./claims/confidence.ts`)
   * rather than a parallel relationship-specific shape same components, same audit story. */
  readonly confidence?: ConfidenceScore;
  /** Count of independent supporting lineages for this relationship's own `evidenceIds`, prior
   * to (and independent of) any full `confidence` computation see
   * `countUniqueSyndicatedEvidenceLineages` in `./relationship-publish.ts` for the syndication
   * dedupe this count is expected to reflect. */
  readonly independentLineageCount?: number;
  /** Joint resolution state of `fromEntityId`/`toEntityId`; see `RelationshipResolutionState`. */
  readonly resolutionState?: RelationshipResolutionState;
  /** Links a promoted/accepted relationship back to the discovery candidate that spawned it. */
  readonly createdFromCandidateId?: string;
  /** ISO timestamp of the last human/automated re-verification pass over this edge. */
  readonly lastVerifiedAt?: string;
};

export function assertRelationshipHasEvidence(rel: Pick<EntityRelationship, 'evidenceIds'>): void {
  if (!rel.evidenceIds || rel.evidenceIds.length === 0) {
    throw new Error('Relationships must include at least one evidence id');
  }
}

// ---------------------------------------------------------------------------
// documented direction/temporal semantics.
// Every relationship reads as a sentence "fromEntity <TYPE> toEntity". This record is the
// single documented source of truth for direction so graph-view builders, the operator-cli
// edge-intake lane, and future readers never have to guess which endpoint is which.
// ---------------------------------------------------------------------------

export type RelationshipTypeSemantics = {
  /** How to read the edge as a sentence: "fromEntity <verb> toEntity". */
  readonly direction: string;
  /** What validFrom/validTo mean for this type, and whether TemporalContext is required. */
  readonly temporalSemantics: string;
  readonly requiresTemporalContext: boolean;
};

export const RELATIONSHIP_TYPE_SEMANTICS: Readonly<Record<RelationshipType, RelationshipTypeSemantics>> = {
  located_at: {
    direction: 'fromEntity is LOCATED_AT toEntity (a place/location entity).',
    temporalSemantics: 'validFrom/validTo bound the occupancy window; open-ended means still located there.',
    requiresTemporalContext: false,
  },
  occurred_at: {
    direction: 'fromEntity (typically an event) OCCURRED_AT toEntity (a place).',
    temporalSemantics: 'validFrom/validTo describe the event window, when distinct from the event entity’s own dates.',
    requiresTemporalContext: false,
  },
  attended: {
    direction:
      'fromEntity (person) ATTENDED toEntity (event). The optional `role` qualifier ' +
      '(organizer|speaker|participant, BB-092) distinguishes organizing/speaking weight from ' +
      'rank-and-file attendance without changing the edge type.',
    temporalSemantics: 'validFrom/validTo scope multi-day attendance; a single-day event needs only validFrom.',
    requiresTemporalContext: false,
  },
  founded: {
    direction:
      'fromEntity (person/organization) FOUNDED toEntity (organization/institution). Reserved for ' +
      'orgs/institutions — creation of a publication/artifact uses `authored` (BB-092) instead.',
    temporalSemantics: 'validFrom is the founding date; validTo is not meaningful (founding is a point in time).',
    requiresTemporalContext: false,
  },
  employed_by: {
    direction: 'fromEntity (person) is EMPLOYED_BY toEntity (organization/institution).',
    temporalSemantics: 'validFrom/validTo bound the employment window; open-ended means still employed.',
    requiresTemporalContext: false,
  },
  member_of: {
    direction: 'fromEntity (person/organization) is MEMBER_OF toEntity (organization/movement).',
    temporalSemantics: 'validFrom/validTo bound membership; open-ended means still a member.',
    requiresTemporalContext: false,
  },
  related_to: {
    direction: 'Symmetric/loose association between fromEntity and toEntity with no stronger typed fit.',
    temporalSemantics: 'Optional; use only when the association itself has a documented window.',
    requiresTemporalContext: false,
  },
  depicts: {
    direction: 'fromEntity (artifact/publication) DEPICTS toEntity (person/place/event).',
    temporalSemantics: 'Optional; validFrom may record when the depiction was made.',
    requiresTemporalContext: false,
  },
  cites: {
    direction:
      'fromEntity CITES toEntity — a documented connection asserted by a source without the ' +
      'stronger causal/participatory claim a more specific edge type would carry. This is the ' +
      'required landing type for contested or single-incident causal claims that do not meet the ' +
      '`caused`/`enabled` guardrail (see `evaluateCausalEdgeGuardrail`), and for BB-086 FactRecord ' +
      '`subjects[]` co-mentions mirrored into the graph (see `./graph/fact-subjects.ts`).',
    temporalSemantics: 'Optional; validFrom may record when the citing source was published/observed.',
    requiresTemporalContext: false,
  },
  governed_by: {
    direction: 'fromEntity is GOVERNED_BY toEntity (a law, or a governing body).',
    temporalSemantics: 'validFrom/validTo bound the governance window; open-ended means still in force.',
    requiresTemporalContext: false,
  },
  part_of: {
    direction:
      'fromEntity is PART_OF toEntity (a coarser containing entity — e.g. a neighborhood part_of a ' +
      'city). Chained with `located_at`, this is the containment edge BB-092’s containment-chain ' +
      'materialization walks (see `./graph/containment.ts`).',
    temporalSemantics: 'validFrom/validTo bound containment when a boundary changed (annexation, redistricting).',
    requiresTemporalContext: false,
  },
  successor_of: {
    direction:
      'fromEntity (the modern successor) is SUCCESSOR_OF toEntity (the superseded historical ' +
      'predecessor) — e.g. a modern municipality successor_of an annexed historical place. The ' +
      'predecessor’s own statusHistory/condition designation must never be read as the successor’s ' +
      'current status (BB-092 acceptance criterion 11) — see `./graph/succession.ts`.',
    temporalSemantics: 'validFrom records the succession/transition date when documented.',
    requiresTemporalContext: false,
  },
  caused: {
    direction:
      'fromEntity CAUSED toEntity — fromEntity is the cause, toEntity is the effect. Reserved for ' +
      'consensus, citable SYSTEMIC historical causation (e.g. HOLC redlining causing measurable ' +
      'disinvestment), never a contested or single-incident causal claim — see ' +
      '`evaluateCausalEdgeGuardrail` (BB-092 acceptance criterion 9).',
    temporalSemantics: 'validFrom (required) marks when the causal effect began manifesting.',
    requiresTemporalContext: true,
  },
  enabled: {
    direction:
      'fromEntity ENABLED toEntity — fromEntity made toEntity possible or more likely without being ' +
      'its sole or direct cause. Same consensus/systemic-causation guardrail as `caused` — a ' +
      'contested claim that a specific statute enabled a specific act of violence routes through ' +
      '`cites` instead.',
    temporalSemantics: 'validFrom (required) marks when the enabling condition took effect.',
    requiresTemporalContext: true,
  },
  influenced: {
    direction:
      'fromEntity INFLUENCED toEntity — a weaker, non-exclusive ideological/stylistic/strategic ' +
      'influence, not an assertion of direct causation.',
    temporalSemantics: 'validFrom (required) marks when the influence is documented to have begun.',
    requiresTemporalContext: true,
  },
  participated_in: {
    direction:
      'fromEntity (person/organization) PARTICIPATED_IN toEntity (event/movement/campaign) — broader ' +
      'involvement than a single event attendance; use `attended` (with its `role` qualifier) for ' +
      'discrete event attendance specifically.',
    temporalSemantics: 'validFrom/validTo bound the participation window.',
    requiresTemporalContext: false,
  },
  overturned: {
    direction: 'fromEntity (case/law) OVERTURNED toEntity (a prior case/law) — legal supersession.',
    temporalSemantics: 'validFrom (required) is the decision/enactment date the supersession took effect.',
    requiresTemporalContext: true,
  },
  commemorates: {
    direction:
      'fromEntity (place/artifact/event) COMMEMORATES toEntity (person/event/movement) — a memorial ' +
      'or dedication relationship; never a causal claim.',
    temporalSemantics: 'validFrom may record the dedication/commemoration date; not required.',
    requiresTemporalContext: false,
  },
  authored: {
    direction:
      'fromEntity (person/organization) AUTHORED toEntity (publication/artifact) — creation ' +
      'attribution, distinct from `founded`, which stays reserved for organizations/institutions.',
    temporalSemantics: 'validFrom may record the publication/creation date; not required.',
    requiresTemporalContext: false,
  },
  other: {
    direction: 'Unclassified relationship; prefer a specific type whenever one fits.',
    temporalSemantics: 'No fixed semantics.',
    requiresTemporalContext: false,
  },
};

/** The six historical-causation edge types whose semantics require a TemporalContext. */
export const CAUSAL_HISTORICAL_RELATIONSHIP_TYPES = (
  Object.keys(RELATIONSHIP_TYPE_SEMANTICS) as readonly RelationshipType[]
).filter((type) => RELATIONSHIP_TYPE_SEMANTICS[type].requiresTemporalContext);

export function relationshipRequiresTemporalContext(type: RelationshipType): boolean {
  return RELATIONSHIP_TYPE_SEMANTICS[type].requiresTemporalContext;
}

/**
 * causal edges (`caused`, `enabled`, `influenced`, `overturned`)
 * require a TemporalContext with at least `validFrom`. Fails closed a causal edge proposed
 * without a temporal anchor is rejected, not silently accepted with an implicit "always true"
 * reading.
 */
export function assertRelationshipTemporalRequirement(
  rel: Pick<EntityRelationship, 'type' | 'temporal'>,
): void {
  if (relationshipRequiresTemporalContext(rel.type) && !rel.temporal?.validFrom) {
    throw new Error(
      `Relationship type "${rel.type}" is a historical-causation edge and requires a ` +
        'TemporalContext with at least validFrom.',
    );
  }
}

/**
 * `role` is only meaningful on `attended` edges. Fails closed on any other type so a
 * role qualifier can never silently attach to, say, a `caused` edge and be misread as weight.
 */
export function assertRelationshipRoleValidForType(
  rel: Pick<EntityRelationship, 'type' | 'role'>,
): void {
  if (rel.role !== undefined && rel.type !== 'attended') {
    throw new Error(
      `Relationship role "${rel.role}" is only valid on "attended" edges (got type "${rel.type}").`,
    );
  }
}

// ---------------------------------------------------------------------------
// caused/enabled consensus-causation guardrail.
// `caused` and `enabled` are reserved for consensus, citable SYSTEMIC historical causation (the
// HOLC-redlining-causes-disinvestment case). A contested or single-incident causal claim (whether
// a specific statute "enabled" a specific act of violence) must never be asserted as a directed
// causal edge with the same confidence as a settled claim it routes through `cites` instead.
// This is a structural intake gate, not a comment: `evaluateCausalEdgeGuardrail` requires the
// caller to supply a `CausalEdgeReview.scope` explicitly, so the distinction is reviewed at
// intake rather than left to submitter judgment.
// ---------------------------------------------------------------------------

/** The two edge types the consensus-causation guardrail applies to. */
export const CAUSAL_ASSERTION_RELATIONSHIP_TYPES = ['caused', 'enabled'] as const;
export type CausalAssertionRelationshipType = (typeof CAUSAL_ASSERTION_RELATIONSHIP_TYPES)[number];

export function isCausalAssertionRelationshipType(
  type: RelationshipType,
): type is CausalAssertionRelationshipType {
  return (CAUSAL_ASSERTION_RELATIONSHIP_TYPES as readonly RelationshipType[]).includes(type);
}

/**
 * `systemic_consensus`: settled, citable secondary-source historical causation (HOLC redlining
 * causing measurable disinvestment). `contested_or_single_incident`: a disputed causal claim or
 * one asserting a single incident's cause (whether a specific statute "enabled" a specific act of
 * violence) never publishable as `caused`/`enabled`, must route through `cites`.
 */
export const CAUSATION_SCOPES = ['systemic_consensus', 'contested_or_single_incident'] as const;
export type CausationScope = (typeof CAUSATION_SCOPES)[number];

export type CausalEdgeReview = {
  readonly scope: CausationScope;
  /** Required when scope is `systemic_consensus`: cites the secondary-source consensus basis. */
  readonly consensusBasis?: string;
};

export type CausalGuardrailResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string; readonly suggestedType: 'cites' };

/**
 * Reviewed-at-intake guardrail for `caused`/`enabled`. Every other relationship type is always
 * allowed (the guardrail is scoped to the two causal-assertion types only). A
 * `contested_or_single_incident` scope is always rejected; a `systemic_consensus` scope without a
 * documented `consensusBasis` is also rejected the reviewer must record *why* the claim is
 * settled/systemic, not merely assert it.
 */
export function evaluateCausalEdgeGuardrail(
  type: RelationshipType,
  review: CausalEdgeReview,
): CausalGuardrailResult {
  if (!isCausalAssertionRelationshipType(type)) {
    return { allowed: true };
  }
  if (review.scope === 'contested_or_single_incident') {
    return {
      allowed: false,
      reason:
        `"${type}" is reserved for consensus, citable systemic historical causation. Contested or ` +
        'single-incident causal claims must use the "cites" edge instead of asserting a causal edge.',
      suggestedType: 'cites',
    };
  }
  if (!review.consensusBasis || !review.consensusBasis.trim()) {
    return {
      allowed: false,
      reason:
        `"${type}" requires a documented consensus/citable-systemic-causation basis ` +
        '(CausalEdgeReview.consensusBasis) at intake.',
      suggestedType: 'cites',
    };
  }
  return { allowed: true };
}

/** Fail-closed wrapper around `evaluateCausalEdgeGuardrail` for intake call sites. */
export function assertCausalEdgeGuardrail(type: RelationshipType, review: CausalEdgeReview): void {
  const result = evaluateCausalEdgeGuardrail(type, review);
  if (!result.allowed) {
    throw new Error(result.reason);
  }
}
