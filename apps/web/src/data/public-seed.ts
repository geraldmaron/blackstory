/**
 * Public-facing seed catalog for the web UI.
 * Mirrors safe fields from packages/firebase/fixtures/firestore-seed.ts for
 * demonstrable pages until public projections and search land.
 * Never includes residential addresses or unpublished high-impact claims.
 */
import {
  buildRelatedNeighborStubs,
  composeContinueLearningStubs,
  type DatePrecision,
  type EntitySensitivity,
  type EntityStatusValue,
  type StatusHistoryEntry,
} from '@black-book/domain';
import {
  buildGraphTimeline,
  currentStatusFor,
  relatedEntriesFor,
  sensitivityFor,
  statusHistoryFor,
  type GraphTimelineEntry,
} from './entity-graph-seed';
import { NATIONAL_STORY_ENTITY_DRAFTS } from './national-story-seed/entities';

export type PublicEntityKind = 'place' | 'school' | 'event' | 'institution';

export type PublicClaimView = {
  readonly id: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceScore: number;
  readonly confidenceLevel: 'high' | 'medium' | 'low';
  readonly citationSource: string;
  readonly citationHref?: string;
  readonly citationLabel: string;
  readonly disputed?: boolean;
  readonly disputeNote?: string;
};

export type PublicTimelineEvent = GraphTimelineEntry;

/**
 * Typed related-entity entry, mirroring `@black-book/domain`'s `PublicRelatedEntry`
 * (packages/domain/src/graph/adjacency.ts) and
 * `packages/firebase/src/firestore/types.ts`'s `publicEntityProjectionSchema.related` — the same
 * shape derived from a release's graph adjacency doc. Hardcoded here rather than imported since
 * this file is a standalone web-app seed catalog predating projections (see the module
 * doc above), matching this file's existing convention of not importing @black-book/domain types.
 */
export type PublicRelatedEntry = {
  readonly id: string;
  readonly type: string;
  readonly direction: 'outgoing' | 'incoming';
  readonly timespan?: { readonly label?: string; readonly validFrom?: string; readonly validTo?: string | null };
};

/** Event when-span: the event kind's when-span is authoritative in place of a `statusHistory`
 * field — an event is never "active" or "historic" (see `STATUSLESS_ENTITY_KINDS`). */
export type PublicEventWindow = {
  readonly startAt?: string;
  readonly endAt?: string | null;
  readonly datePrecision: DatePrecision;
  readonly eventType?: string;
};

/** Minimal release/revision provenance. Full claim-version diffing and revision browsing
 * is a separate concern (see the entity page's own "Evidence & projection depth" placeholder);
 * this is the honest scaffold-depth metadata available from a seed fixture standing in for a
 * release. */
export type PublicRevisionMetadata = {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly recordUpdatedAt: string;
};

/** Rights-cleared optional hero image for learning-index entity pages. */
export type PublicEntityPrimaryImageView = {
  readonly url: string;
  readonly alt: string;
  readonly credit: string;
  readonly rightsStatus: 'public_domain' | 'licensed' | 'fair_use';
  readonly width?: number;
  readonly height?: number;
  readonly objectPath?: string;
};

/** Denormalized related neighbor for entity-page learning links (1-hop or 2-hop). */
export type RelatedNeighborView = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: PublicEntityKind | string;
  readonly summary: string;
  readonly relationType: string;
  readonly direction: 'outgoing' | 'incoming';
  readonly timespan?: {
    readonly label?: string;
    readonly validFrom?: string;
    readonly validTo?: string | null;
  };
};

export type PublicEntityView = {
  readonly id: string;
  readonly kind: PublicEntityKind;
  readonly displayName: string;
  readonly summary: string;
  /** @deprecated Free-text era label predating structured era model. Prefer
   * `eraBuckets`, derived from @black-book/domain's `deriveEraBuckets`. Kept for existing
   * filter/display call sites until they migrate. */
  readonly era: string;
  /**
   * Public projection additions — every one non-numeric by standing policy (numeric
   * notability/relevance scores are banned from public payloads).
   */
  /** Derived current lifecycle status label (e.g. "active", "in_force"), when the entity kind
   * carries one. Never hand-edited — derived via @black-book/domain's `currentEntityStatus`. */
  readonly status?: string;
  /** Time-scoped status-lifecycle designations for place/school/institution kinds omitted
   * for `event` (see `eventWindow`). `status` above is always `currentStatus(statusHistory)`,
   * never an independent hand-set value. */
  readonly statusHistory?: readonly StatusHistoryEntry<EntityStatusValue>[];
  /** `event`-kind entities carry this instead of `statusHistory`/`status`.  */
  readonly eventWindow?: PublicEventWindow;
  /** Decade labels the entity's dated span overlaps, derived via @black-book/domain's
   * `deriveEraBuckets` replaces the free-text `era` string above. */
  readonly eraBuckets?: readonly string[];
  /** Human-readable notability rubric labels (never the raw criterion id alone, never a score),
   * one per notabilityBasis record sourced from @black-book/domain's `NOTABILITY_RUBRIC`. */
  readonly notabilityLabels?: readonly string[];
  /** Sensitivity classification label, when the entity carries one. Presentation is via
   * `SensitivityContextBanner`. */
  readonly sensitivityClass?: string;
  /** Full schema-only sensitivity record ({class, note, basisClaimIds}) — the shape the
   * `SensitivityContextBanner` consumes. `sensitivityClass` above stays a plain string for
   * the pre-existing search-index adapter; this is the richer projection the entity page renders. */
  readonly sensitivity?: EntitySensitivity;
  readonly topicTags: readonly string[];
  readonly jurisdictionLabel: string;
  /** City, campus, or neighborhood — never street or residence. */
  readonly locationPrecision: 'city' | 'neighborhood' | 'campus' | 'institution';
  readonly locationLabel: string;
  readonly relevanceExplanation: string;
  /** Concise framing of this record's place within documented Black history general context,
   * not new unsourced facts about this specific record (those live in `claims`). Guards against a
   * page reading as a generic biography unrelated to place/Black history. */
  readonly historicalContext: string;
  /** Optional multi-paragraph further reading; omit UI when absent. */
  readonly extendedNarrative?: string;
  /** Optional rights-cleared primary image; omit UI when absent. */
  readonly primaryImage?: PublicEntityPrimaryImageView;
  readonly recordMaturity: string;
  readonly researchCoverage: 'minimal' | 'partial' | 'substantial';
  readonly mapPin: { readonly x: number; readonly y: number };
  readonly claims: readonly PublicClaimView[];
  readonly timeline: readonly PublicTimelineEvent[];
  readonly revision: PublicRevisionMetadata;
  /** @deprecated Untyped predecessor to `related`. Kept for existing call sites until
   * they migrate to the typed `{id, type, direction, timespan}` shape. */
  readonly relatedIds: readonly string[];
  /** Typed related entries — see `PublicRelatedEntry` above.
   * Optional so existing seed fixtures keep working until they're backfilled. */
  readonly related?: readonly PublicRelatedEntry[];
  /** Hydrated 1-hop neighbors for learning links (populated at read time). */
  readonly relatedNeighbors?: readonly RelatedNeighborView[];
  /** Capped 2-hop continue-learning stubs (composed at read time, not stored). */
  readonly continueLearning?: readonly RelatedNeighborView[];
};

function confidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

const SEED_RELEASE_ID = 'seed-snapshot';
const SEED_GENERATED_AT = '2026-07-17T00:00:00.000Z';

function revisionFor(recordUpdatedAt: string): PublicRevisionMetadata {
  return { releaseId: SEED_RELEASE_ID, generatedAt: SEED_GENERATED_AT, recordUpdatedAt };
}

// Precomputed derived values, spread conditionally below (exactOptionalPropertyTypes
// forbids assigning a possibly-`undefined`-typed value directly to an optional property).
const PLACE_STATUS = currentStatusFor('ent_seed_place_001');
const PLACE_STATUS_HISTORY = statusHistoryFor('ent_seed_place_001');
const PLACE_SENSITIVITY = sensitivityFor('ent_seed_place_001');
const SCHOOL_STATUS = currentStatusFor('ent_seed_school_001');
const SCHOOL_STATUS_HISTORY = statusHistoryFor('ent_seed_school_001');
const INSTITUTION_STATUS = currentStatusFor('ent_seed_institution_001');
const INSTITUTION_STATUS_HISTORY = statusHistoryFor('ent_seed_institution_001');

/**
 * Seed entities aligned with firestore-seed public projections. One fixture per kind this 
 * covers (place, school, event, institution) a small, connected graph (school located_at place;
 * event occurred_at school; institution commemorates event) so the graph-view builders in
 * `./entity-graph-seed.ts` have real edges to derive `related`/`timeline` from. Person fixtures are
 * intentionally omitted from public browse.
 *
 * `timeline` is filled in below via a second pass over this draft array (`PUBLIC_SEED_ENTITIES`)
 * so its relationship sentences can resolve neighbor display names across fixtures; `related` is
 * already the real graph-builder output (see `relatedEntriesFor`), not hand-authored.
 */
const SEED_ENTITY_DRAFTS: readonly Omit<PublicEntityView, 'timeline'>[] = [
  {
    id: 'ent_seed_place_001',
    kind: 'place',
    displayName: 'Seed Historical Place',
    summary:
      'A historically documented Black community place in the District of Columbia area, ' +
      'tied to education and mutual-aid networks with published archival claims for learners.',
    era: 'reconstruction',
    ...(PLACE_STATUS !== undefined ? { status: PLACE_STATUS } : {}),
    ...(PLACE_STATUS_HISTORY !== undefined ? { statusHistory: PLACE_STATUS_HISTORY } : {}),
    eraBuckets: ['1860s', '1870s'],
    notabilityLabels: [
      'The entity is a documented site of a historically significant event or practice with primary-source evidence tying the site to the event.',
    ],
    ...(PLACE_SENSITIVITY !== undefined
      ? { sensitivityClass: PLACE_SENSITIVITY.class, sensitivity: PLACE_SENSITIVITY }
      : {}),
    topicTags: ['community', 'education', 'reconstruction'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'city',
    locationLabel: 'Washington, D.C. (city-level pin)',
    relevanceExplanation:
      'Included because archival records connect this place to Black educational and community history with accepted, published claims above the constitution relevance threshold. Sample seed data — not a live public release.',
    historicalContext:
      'Reconstruction-era Black communities in the District of Columbia organized schools and mutual ' +
      'aid networks largely without support from the segregated municipal government. This record ' +
      'documents one such site; see Accepted claims below for statements specific to it.',
    recordMaturity: 'partial_enrichment',
    researchCoverage: 'partial',
    mapPin: { x: 48, y: 42 },
    claims: [
      {
        id: 'claim_seed_001',
        predicate: 'founded_year',
        object: '1867',
        confidenceScore: 0.78,
        confidenceLevel: confidenceLevel(0.78),
        citationSource: 'National Archives and Records Administration — Catalog (seed)',
        citationHref: 'https://catalog.archives.gov/',
        citationLabel: 'Primary archival',
        disputed: true,
        disputeNote:
          'A credible alternate founding year (1868) is preserved; both values remain visible.',
      },
      {
        id: 'claim_seed_005',
        predicate: 'documented_dispute',
        object: 'Contested 1920s land-use displacement action',
        confidenceScore: 0.66,
        confidenceLevel: confidenceLevel(0.66),
        citationSource: 'D.C. Historical Society — archival case file (seed)',
        citationLabel: 'Reputable secondary',
      },
    ],
    revision: revisionFor('2026-06-01T00:00:00.000Z'),
    relatedIds: ['ent_seed_school_001'],
    related: relatedEntriesFor('ent_seed_place_001'),
  },
  {
    id: 'ent_seed_school_001',
    kind: 'school',
    displayName: 'Seed Freedmen School',
    summary:
      'Freedmen school with documented historical and current campus locations at campus ' +
      'precision only — a multi-era educational anchor for Black public schooling in D.C.',
    era: 'reconstruction',
    ...(SCHOOL_STATUS !== undefined ? { status: SCHOOL_STATUS } : {}),
    ...(SCHOOL_STATUS_HISTORY !== undefined ? { statusHistory: SCHOOL_STATUS_HISTORY } : {}),
    eraBuckets: ['1860s', '1870s', '1900s', '1910s'],
    notabilityLabels: [
      'The entity served as a long-standing, evidenced community anchor institution with a documented multi-decade role in a specific community.',
    ],
    topicTags: ['education', 'freedmen', 'schools'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'campus',
    locationLabel: 'Campus extent (schematic)',
    relevanceExplanation:
      'Qualifies as a place-connected educational institution with multi-era campus history tied to Black public schooling. Sample seed data pending BB-019 projection builders.',
    historicalContext:
      'Freedmen schools, often founded by formerly enslaved communities and northern aid societies, ' +
      'were among the first formal Black educational institutions in the post-Emancipation District ' +
      'of Columbia. See Accepted claims below for statements specific to this record.',
    extendedNarrative:
      'This seed further-reading block shows how longer curated prose can deepen a record without ' +
      'replacing Accepted claims. Educators can use it as a bridge from the short summary into ' +
      'primary-source investigation. Sample seed data — not a live public release.',
    primaryImage: {
      url: 'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_seed_school_001/primary.png',
      alt: 'Schematic mark representing Seed Freedmen School campus record',
      credit: 'Black Book brand system public-domain-style fixture for seed demos',
      rightsStatus: 'public_domain',
      objectPath: 'public/entities/ent_seed_school_001/primary.png',
    },
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    mapPin: { x: 55, y: 50 },
    claims: [
      {
        id: 'claim_seed_002',
        predicate: 'operated_as',
        object: 'Colored School No. 1 (1868–1954)',
        confidenceScore: 0.8,
        confidenceLevel: confidenceLevel(0.8),
        citationSource: 'D.C. Public Schools — historical register (seed)',
        citationLabel: 'Government record',
      },
      {
        id: 'claim_seed_003',
        predicate: 'campus_relocated',
        object: '1954',
        confidenceScore: 0.82,
        confidenceLevel: confidenceLevel(0.82),
        citationSource: 'D.C. Public Schools — historical register (seed)',
        citationLabel: 'Government record',
      },
    ],
    revision: revisionFor('2026-06-15T00:00:00.000Z'),
    relatedIds: ['ent_seed_place_001'],
    related: relatedEntriesFor('ent_seed_school_001'),
  },
  {
    id: 'ent_seed_event_001',
    kind: 'event',
    displayName: 'Seed Emancipation Day Commemoration',
    summary:
      'A documented 1954 campus commemoration marking the connected school\u2019s relocation, ' +
      'linking educational transition to mid-century community organizing in Washington, D.C.',
    era: 'mid_20th_century',
    eventWindow: { startAt: '1954', endAt: null, datePrecision: 'year', eventType: 'commemoration' },
    eraBuckets: ['1950s'],
    notabilityLabels: [
      'The entity played a documented, non-incidental role in a named movement — organizing, ' +
        'hosting, or being a recognized site or symbol of it.',
    ],
    topicTags: ['commemoration', 'civil-rights', 'community'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'campus',
    locationLabel: 'Seed Freedmen School campus (schematic)',
    relevanceExplanation:
      'Documented commemoration tying the school\u2019s 1954 campus relocation to the surrounding community\u2019s civil-rights-era organizing. Sample seed data pending BB-019 projection builders.',
    historicalContext:
      'Commemorative ceremonies at Black community anchor institutions during the mid-20th century ' +
      'often marked transitions — a relocation, a closure, a renaming — as community-wide events, ' +
      'not merely institutional milestones. See Accepted claims below for statements specific to ' +
      'this record.',
    recordMaturity: 'minimum_record',
    researchCoverage: 'minimal',
    mapPin: { x: 56, y: 51 },
    claims: [
      {
        id: 'claim_seed_006',
        predicate: 'occurred_on',
        object: '1954',
        confidenceScore: 0.6,
        confidenceLevel: confidenceLevel(0.6),
        citationSource: 'Community oral history collection (seed)',
        citationLabel: 'Community oral',
      },
    ],
    revision: revisionFor('2026-06-20T00:00:00.000Z'),
    relatedIds: ['ent_seed_school_001', 'ent_seed_institution_001'],
    related: relatedEntriesFor('ent_seed_event_001'),
  },
  {
    id: 'ent_seed_institution_001',
    kind: 'institution',
    displayName: 'Seed Heritage Preservation Society',
    summary:
      'A community heritage society documenting and commemorating the connected school\u2019s ' +
      'history since 1975 — an institutional memory keepers for place-based learning.',
    era: 'late_20th_century',
    ...(INSTITUTION_STATUS !== undefined ? { status: INSTITUTION_STATUS } : {}),
    ...(INSTITUTION_STATUS_HISTORY !== undefined ? { statusHistory: INSTITUTION_STATUS_HISTORY } : {}),
    eraBuckets: ['1970s'],
    notabilityLabels: [
      'The entity served as a long-standing, evidenced community anchor institution with a documented multi-decade role in a specific community.',
    ],
    topicTags: ['heritage', 'preservation', 'community'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'institution',
    locationLabel: 'Institutional address (schematic)',
    relevanceExplanation:
      'Community-anchor institution with a documented, multi-decade role preserving the connected school and event records above. Sample seed data pending BB-019 projection builders.',
    historicalContext:
      'Heritage-preservation societies founded by descendant communities in the 1970s frequently ' +
      'formed to document and commemorate sites — like this record\u2019s connected school and event — ' +
      'that municipal institutions had not preserved. See Accepted claims below for statements ' +
      'specific to this record.',
    recordMaturity: 'minimum_record',
    researchCoverage: 'minimal',
    mapPin: { x: 57, y: 52 },
    claims: [
      {
        id: 'claim_seed_004',
        predicate: 'founded_year',
        object: '1975',
        confidenceScore: 0.7,
        confidenceLevel: confidenceLevel(0.7),
        citationSource: 'D.C. Historical Society — organization registry (seed)',
        citationLabel: 'Reputable secondary',
      },
    ],
    revision: revisionFor('2026-07-01T00:00:00.000Z'),
    relatedIds: ['ent_seed_event_001'],
    related: relatedEntriesFor('ent_seed_institution_001'),
  },
  ...NATIONAL_STORY_ENTITY_DRAFTS,
];

const DISPLAY_NAME_LOOKUP: ReadonlyMap<string, { readonly displayName: string }> = new Map(
  SEED_ENTITY_DRAFTS.map((entity) => [entity.id, { displayName: entity.displayName }]),
);

function hydrateLearningLinks(
  entities: readonly PublicEntityView[],
): readonly PublicEntityView[] {
  const neighborsById = new Map(
    entities.map((entity) => [
      entity.id,
      {
        id: entity.id,
        displayName: entity.displayName,
        kind: entity.kind,
        summary: entity.summary,
        ...(entity.related !== undefined ? { related: entity.related } : {}),
      },
    ]),
  );

  return entities.map((entity) => {
    const relatedNeighborStubs = buildRelatedNeighborStubs(entity.related, neighborsById);
    const continueLearningStubs = composeContinueLearningStubs(
      entity.id,
      relatedNeighborStubs,
      neighborsById,
    );

    const toView = (stub: (typeof relatedNeighborStubs)[number]): RelatedNeighborView =>
      stub.timespan !== undefined
        ? {
            id: stub.id,
            displayName: stub.displayName,
            kind: stub.kind,
            summary: stub.summary,
            relationType: stub.relationType,
            direction: stub.direction,
            timespan: stub.timespan,
          }
        : {
            id: stub.id,
            displayName: stub.displayName,
            kind: stub.kind,
            summary: stub.summary,
            relationType: stub.relationType,
            direction: stub.direction,
          };

    const relatedNeighbors = relatedNeighborStubs.map(toView);
    const continueLearning = continueLearningStubs.map(toView);
    return {
      ...entity,
      ...(relatedNeighbors.length > 0 ? { relatedNeighbors } : {}),
      ...(continueLearning.length > 0 ? { continueLearning } : {}),
    };
  });
}

export const PUBLIC_SEED_ENTITIES: readonly PublicEntityView[] = hydrateLearningLinks(
  SEED_ENTITY_DRAFTS.map((entity) => ({
    ...entity,
    timeline: buildGraphTimeline(entity, DISPLAY_NAME_LOOKUP),
  })),
);

export const FEATURED_SEED_IDS = ['ent_seed_school_001', 'ent_seed_place_001'] as const;

export function getPublicEntity(id: string): PublicEntityView | undefined {
  return PUBLIC_SEED_ENTITIES.find((entity) => entity.id === id);
}

export function listPublicEntities(): readonly PublicEntityView[] {
  return PUBLIC_SEED_ENTITIES;
}

export type SeedSearchParams = {
  readonly q?: string;
  readonly kind?: string;
  readonly era?: string;
  readonly topic?: string;
};

export function filterPublicEntities(params: SeedSearchParams): readonly PublicEntityView[] {
  const q = (params.q ?? '').trim().toLowerCase();
  const kind = (params.kind ?? 'all').toLowerCase();
  const era = (params.era ?? 'all').toLowerCase();
  const topic = (params.topic ?? 'all').toLowerCase();

  return PUBLIC_SEED_ENTITIES.filter((entity) => {
    if (kind !== 'all' && entity.kind !== kind) return false;
    if (era !== 'all' && entity.era !== era) return false;
    if (topic !== 'all' && !entity.topicTags.includes(topic)) return false;
    if (!q) return true;
    const haystack = [
      entity.displayName,
      entity.summary,
      entity.jurisdictionLabel,
      ...entity.topicTags,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
