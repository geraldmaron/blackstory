/**
 * Gold-corpus-style graph fixtures: synthetic, adjudicated scenarios exercising the
 * graph-view build's hard invariants — determinism, cycle-safety, bounded-depth
 * containment, active-span decade bucketing, succession non-leakage, the caused/enabled
 * consensus guardrail, and FactRecord `subjects` mirroring. Every entity/event name is a
 * generic synthetic fixture label (never a real person, place, or event), matching the
 * discipline of `packages/testing/src/gold-corpus/fixtures/gold-corpus.v1.json`'s
 * `synthetic: true` examples: these exercise mechanics, not real historical claims.
 *
 * Not wired live: a future pass can wire these into `packages/testing/src/gold-corpus`'s
 * regression harness (`evaluateCorpus`) by extending `GoldCorpusExample.subjectType` with a
 * `'graph'` variant, or by adding a parallel `graph-corpus.v1.json` + evaluator alongside the
 * existing relevance-adjudication corpus. Until then, `GRAPH_GOLD_FIXTURES` is covered by this
 * package's own suite (`./build.test.ts`, `./containment.test.ts`, `./succession.test.ts`,
 * `./decades.test.ts`, `../relationship.test.ts`).
 */
import type { EraSpan } from '../era.js';
import type { EntityStatusValue, StatusHistoryEntry } from '../entity-status.js';
import type { EntityRelationship } from '../relationship.js';
import type { ContainmentEntityInput } from './containment.js';
import type { DecadeBucketEntityInput } from './decades.js';
import type { FactSubjectSource } from './fact-subjects.js';

const EV = ['gg-ev-1'] as const; // shared placeholder evidence id for fixture relationships

function rel(
  overrides: Partial<EntityRelationship> & Pick<EntityRelationship, 'id' | 'fromEntityId' | 'toEntityId' | 'type'>,
): EntityRelationship {
  return {
    evidenceIds: [...EV],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scenario 1: containment chain, spot -> city -> county -> state.
// ---------------------------------------------------------------------------
export const CONTAINMENT_CHAIN_ENTITIES: readonly ContainmentEntityInput[] = [
  { entityId: 'gg-place-spot', jurisdictionIds: [] },
  { entityId: 'gg-place-city', jurisdictionIds: ['gg-jur-city'] },
  { entityId: 'gg-place-county', jurisdictionIds: ['gg-jur-county'] },
  { entityId: 'gg-place-state', jurisdictionIds: ['gg-jur-state'] },
];

export const CONTAINMENT_CHAIN_RELATIONSHIPS: readonly EntityRelationship[] = [
  rel({ id: 'gg-rel-loc-1', fromEntityId: 'gg-place-spot', toEntityId: 'gg-place-city', type: 'located_at' }),
  rel({ id: 'gg-rel-loc-2', fromEntityId: 'gg-place-city', toEntityId: 'gg-place-county', type: 'part_of' }),
  rel({ id: 'gg-rel-loc-3', fromEntityId: 'gg-place-county', toEntityId: 'gg-place-state', type: 'part_of' }),
];

// ---------------------------------------------------------------------------
// Scenario 2: a deliberate part_of cycle must not hang the build (cycle-safety proof).
// ---------------------------------------------------------------------------
export const CONTAINMENT_CYCLE_ENTITIES: readonly ContainmentEntityInput[] = [
  { entityId: 'gg-place-cycle-a', jurisdictionIds: ['gg-jur-cycle-a'] },
  { entityId: 'gg-place-cycle-b', jurisdictionIds: ['gg-jur-cycle-b'] },
];

export const CONTAINMENT_CYCLE_RELATIONSHIPS: readonly EntityRelationship[] = [
  rel({ id: 'gg-rel-cycle-1', fromEntityId: 'gg-place-cycle-a', toEntityId: 'gg-place-cycle-b', type: 'part_of' }),
  rel({ id: 'gg-rel-cycle-2', fromEntityId: 'gg-place-cycle-b', toEntityId: 'gg-place-cycle-a', type: 'part_of' }),
];

// ---------------------------------------------------------------------------
// Scenario 3: historical-causation vocabulary + attended role + authored.
// `gg-rel-caused-1` models a settled-systemic-causation example shape (a documented policy
// causing measurable disinvestment) WITHOUT naming the real historical policy — see
// `../relationship.test.ts` for the guardrail evaluation this fixture is paired with.
// ---------------------------------------------------------------------------
export const CAUSATION_VOCAB_RELATIONSHIPS: readonly EntityRelationship[] = [
  rel({
    id: 'gg-rel-attended-1',
    fromEntityId: 'gg-person-organizer',
    toEntityId: 'gg-event-rally',
    type: 'attended',
    role: 'organizer',
    temporal: { validFrom: '1963' },
  }),
  rel({
    id: 'gg-rel-founded-1',
    fromEntityId: 'gg-person-organizer',
    toEntityId: 'gg-org-league',
    type: 'founded',
    temporal: { validFrom: '1957' },
  }),
  rel({
    id: 'gg-rel-authored-1',
    fromEntityId: 'gg-person-organizer',
    toEntityId: 'gg-publication-address',
    type: 'authored',
    temporal: { validFrom: '1963' },
  }),
  rel({
    id: 'gg-rel-participated-1',
    fromEntityId: 'gg-org-league',
    toEntityId: 'gg-event-rally',
    type: 'participated_in',
    temporal: { validFrom: '1963', validTo: '1963' },
  }),
  rel({
    id: 'gg-rel-overturned-1',
    fromEntityId: 'gg-case-appeal',
    toEntityId: 'gg-law-restriction',
    type: 'overturned',
    temporal: { validFrom: '1968' },
  }),
  rel({
    id: 'gg-rel-commemorates-1',
    fromEntityId: 'gg-place-modern-city',
    toEntityId: 'gg-event-rally',
    type: 'commemorates',
    temporal: { validFrom: '1990' },
  }),
  rel({
    id: 'gg-rel-caused-1',
    fromEntityId: 'gg-policy-exclusionary-lending',
    toEntityId: 'gg-place-disinvested-district',
    type: 'caused',
    temporal: { validFrom: '1935', validTo: '1968' },
    notes:
      'Fixture for the settled-systemic-causation case (BB-092 acceptance criterion 9) — a ' +
      'documented lending policy causing measurable disinvestment, the shape of the bead\'s own ' +
      'HOLC-redlining example without naming the real historical policy.',
  }),
];

// ---------------------------------------------------------------------------
// Scenario 4: succession chain non-leakage (canonical place-annexation case).
// ---------------------------------------------------------------------------
export const SUCCESSION_RELATIONSHIP: EntityRelationship = rel({
  id: 'gg-rel-successor-1',
  fromEntityId: 'gg-place-modern-city', // successor
  toEntityId: 'gg-place-historic-town', // predecessor
  type: 'successor_of',
  temporal: { validFrom: '1962' },
});

export const HISTORIC_PREDECESSOR_STATUS_HISTORY: readonly StatusHistoryEntry<EntityStatusValue>[] = [
  {
    status: 'active',
    validFrom: '1880',
    validTo: '1962',
    datePrecision: 'year',
    basisClaimIds: ['gg-claim-historic-active'],
  },
  {
    status: 'historic',
    validFrom: '1962',
    validTo: null,
    datePrecision: 'year',
    basisClaimIds: ['gg-claim-historic-annexed'],
  },
];

export const MODERN_SUCCESSOR_STATUS_HISTORY: readonly StatusHistoryEntry<EntityStatusValue>[] = [
  {
    status: 'active',
    validFrom: '1962',
    validTo: null,
    datePrecision: 'year',
    basisClaimIds: ['gg-claim-modern-active'],
  },
];

// ---------------------------------------------------------------------------
// Scenario 5: active-span decade bucketing. An
// organization founded in the 1950s with an OPEN-ENDED (still active) status-history record must
// appear in every published decade through the "still active" cutoff, not only its founding decade.
// ---------------------------------------------------------------------------
export const STILL_ACTIVE_ORG_ACTIVE_SPANS: readonly EraSpan[] = [
  { validFrom: '1957', validTo: null, datePrecision: 'year' },
];

export const STILL_ACTIVE_ORG_DECADE_INPUT: DecadeBucketEntityInput = {
  entityId: 'gg-org-league',
  activeSpans: STILL_ACTIVE_ORG_ACTIVE_SPANS,
};

/** A one-decade-only comparison entity a single event, so its decade bucket never expands. */
export const SINGLE_DECADE_EVENT_DECADE_INPUT: DecadeBucketEntityInput = {
  entityId: 'gg-event-rally',
  activeSpans: [{ validFrom: '1963', validTo: '1963', datePrecision: 'year' }],
};

// ---------------------------------------------------------------------------
// Scenario 6: FactRecord subjects mirroring an entity
// connected to another ONLY through shared fact subjects, no formal EntityRelationship anywhere.
// ---------------------------------------------------------------------------
export const FACT_SUBJECT_FIXTURES: readonly FactSubjectSource[] = [
  {
    factId: 'gg-fact-1',
    subjects: [{ subjectEntityId: 'gg-person-subject' }, { subjectEntityId: 'gg-event-incident' }],
    evidenceIds: ['gg-ev-fact-1'],
    temporal: { validFrom: '1955' },
  },
];

/** Aggregate bundle a single test can pull the whole gold corpus from at once. */
export const GRAPH_GOLD_FIXTURES = {
  containmentChain: {
    entities: CONTAINMENT_CHAIN_ENTITIES,
    relationships: CONTAINMENT_CHAIN_RELATIONSHIPS,
  },
  containmentCycle: {
    entities: CONTAINMENT_CYCLE_ENTITIES,
    relationships: CONTAINMENT_CYCLE_RELATIONSHIPS,
  },
  causationVocabulary: CAUSATION_VOCAB_RELATIONSHIPS,
  succession: {
    edge: SUCCESSION_RELATIONSHIP,
    predecessorStatusHistory: HISTORIC_PREDECESSOR_STATUS_HISTORY,
    successorStatusHistory: MODERN_SUCCESSOR_STATUS_HISTORY,
  },
  decadeBucketing: {
    stillActiveOrg: STILL_ACTIVE_ORG_DECADE_INPUT,
    singleDecadeEvent: SINGLE_DECADE_EVENT_DECADE_INPUT,
  },
  factSubjects: FACT_SUBJECT_FIXTURES,
} as const;
