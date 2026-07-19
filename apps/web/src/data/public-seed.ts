/**
 * Public-facing seed catalog for the web UI.
 * Mirrors safe fields from packages/firebase/fixtures/firestore-seed.ts for
 * demonstrable pages until public projections and search land. This is a real, fully-cited
 * historical dataset (the Fifteenth Street Presbyterian Church / Paul Laurence Dunbar High
 * School cluster) standing in for a live release pipeline until public projections land.
 * The facts and citations below are real, not placeholders.
 * Never includes residential addresses or unpublished high-impact claims.
 */
import {
  buildRelatedNeighborStubs,
  composeContinueLearningStubs,
} from '@repo/domain/learning-index';
import type { DatePrecision } from '@repo/domain/era';
import {
  NOTABILITY_RUBRIC,
  type EntitySensitivity,
  type EntityStatusValue,
  type NotabilityBasisRecord,
  type StatusHistoryEntry,
} from '@repo/domain/entity-status';
import {
  buildGraphTimeline,
  currentStatusFor,
  relatedEntriesFor,
  sensitivityFor,
  statusHistoryFor,
  type GraphTimelineEntry,
} from './entity-graph-seed';

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
 * Typed related-entity entry, mirroring `@repo/domain`'s `PublicRelatedEntry`
 * (packages/domain/src/graph/adjacency.ts) and
 * `packages/firebase/src/firestore/types.ts`'s `publicEntityProjectionSchema.related` — the same
 * shape derived from a release's graph adjacency doc. Hardcoded here rather than imported since
 * this file is a standalone web-app seed catalog predating projections (see the module
 * doc above), matching this file's existing convention of not importing @repo/domain types.
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
   * `eraBuckets`, derived from @repo/domain's `deriveEraBuckets`. Kept for existing
   * filter/display call sites until they migrate. */
  readonly era: string;
  /**
   * Public projection additions — every one non-numeric by standing policy (numeric
   * notability/relevance scores are banned from public payloads).
   */
  /** Derived current lifecycle status label (e.g. "active", "in_force"), when the entity kind
   * carries one. Never hand-edited — derived via @repo/domain's `currentEntityStatus`. */
  readonly status?: string;
  /** Time-scoped status-lifecycle designations for place/school/institution kinds omitted
   * for `event` (see `eventWindow`). `status` above is always `currentStatus(statusHistory)`,
   * never an independent hand-set value. */
  readonly statusHistory?: readonly StatusHistoryEntry<EntityStatusValue>[];
  /** `event`-kind entities carry this instead of `statusHistory`/`status`.  */
  readonly eventWindow?: PublicEventWindow;
  /** Decade labels the entity's dated span overlaps, derived via @repo/domain's
   * `deriveEraBuckets` replaces the free-text `era` string above. */
  readonly eraBuckets?: readonly string[];
  /** Human-readable notability rubric labels (never the raw criterion id alone, never a score),
   * one per notabilityBasis record sourced from @repo/domain's `NOTABILITY_RUBRIC`. */
  readonly notabilityLabels?: readonly string[];
  /** Structured, auditable inclusion basis backing `notabilityLabels` above (the related workstream).
   * Live release projections carry this directly (see `@repo/domain`'s
   * `buildReleaseEntityArtifacts`); this bundled seed catalog predates the release builder and
   * does not populate it, so read-path adapters (`snapshot-search-index.ts`,
   * `entity/[id]/adapters.ts`) still synthesize a basis from `notabilityLabels` when this is
   * absent. */
  readonly notabilityBasis?: readonly NotabilityBasisRecord[];
  /** Sensitivity classification label, when the entity carries one. Presentation is via
   * `SensitivityContextBanner`. */
  readonly sensitivityClass?: string;
  /** Full schema-only sensitivity record ({class, note, basisClaimIds}) — the shape the
   * `SensitivityContextBanner` consumes. `sensitivityClass` above stays a plain string for
   * the pre-existing search-index adapter; this is the richer projection the entity page renders. */
  readonly sensitivity?: EntitySensitivity;
  /** @deprecated Superseded by `topicIds` (the related workstream). Kept for backward compatibility;
   * the map/list facet builder falls back to this, filtered through `@repo/domain`'s
   * `TOPIC_REGISTRY`, when `topicIds` is absent. */
  readonly topicTags: readonly string[];
  /** Controlled historical-theme ids (the related workstream) — the ONLY field the explore-map theme
   * facet should be built from. Optional: this bundled seed predates the split, so entries
   * below don't populate it yet and the facet builder falls back to `topicTags`. */
  readonly topicIds?: readonly string[];
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
  /** Public-precision coordinate anchor carried by live release projections. When present the
   * map source builder uses it directly; `entity-geo.ts`'s repo-side table remains only as the
   * seed-era fallback for bundled fixtures (that module's own documented retirement path). */
  readonly geoAnchor?: {
    readonly lat: number;
    readonly lng: number;
    readonly geohash: string;
    readonly matchMethod: string;
  };
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
const PLACE_STATUS = currentStatusFor('ent_15th_st_church_001');
const PLACE_STATUS_HISTORY = statusHistoryFor('ent_15th_st_church_001');
const SCHOOL_STATUS = currentStatusFor('ent_dunbar_school_001');
const SCHOOL_STATUS_HISTORY = statusHistoryFor('ent_dunbar_school_001');
const SCHOOL_SENSITIVITY = sensitivityFor('ent_dunbar_school_001');
const INSTITUTION_STATUS = currentStatusFor('ent_dunbar_alumni_federation_001');
const INSTITUTION_STATUS_HISTORY = statusHistoryFor('ent_dunbar_alumni_federation_001');

/**
 * Seed entities aligned with firestore-seed public projections. One fixture per kind this
 * covers (place, school, event, institution) a small, connected graph (school located_at place;
 * event occurred_at school; institution commemorates event) so the graph-view builders in
 * `./entity-graph-seed.ts` have real edges to derive `related`/`timeline` from. Person fixtures are
 * intentionally omitted from public browse.
 *
 * This cluster is real, fully-cited history: Fifteenth Street Presbyterian Church hosted the 1870
 * founding of what became Paul Laurence Dunbar High School (the first public high school for
 * Black students in the United States), whose 1975 D.C. Inventory of Historic Sites listing the
 * Dunbar Alumni Federation (founded 2002) exists to commemorate. Every claim below cites a real,
 * checkable source; see each claim's `citationHref`.
 *
 * `timeline` is filled in below via a second pass over this draft array (`PUBLIC_SEED_ENTITIES`)
 * so its relationship sentences can resolve neighbor display names across fixtures; `related` is
 * already the real graph-builder output (see `relatedEntriesFor`), not hand-authored.
 */
const SEED_ENTITY_DRAFTS: readonly Omit<PublicEntityView, 'timeline'>[] = [
  {
    id: 'ent_15th_st_church_001',
    kind: 'place',
    displayName: 'Fifteenth Street Presbyterian Church',
    summary:
      'Founded in 1841 by Rev. John F. Cook Sr., Washington’s first Black Presbyterian pastor, ' +
      'Fifteenth Street Presbyterian Church hosted the 1870 founding of the nation’s first public ' +
      'high school for Black students in its basement.',
    era: 'reconstruction',
    ...(PLACE_STATUS !== undefined ? { status: PLACE_STATUS } : {}),
    ...(PLACE_STATUS_HISTORY !== undefined ? { statusHistory: PLACE_STATUS_HISTORY } : {}),
    eraBuckets: ['1840s', '1870s'],
    notabilityLabels: [NOTABILITY_RUBRIC.community_anchor],
    topicTags: ['church', 'education', 'community'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'neighborhood',
    locationLabel: 'Dupont/Sixteenth Street Historic District area (neighborhood-level pin)',
    relevanceExplanation:
      'Included as a documented community anchor with a multi-decade role hosting Black educational ' +
      'history in the District of Columbia, above the constitution relevance threshold.',
    historicalContext:
      'Washington’s historically Black Presbyterian congregations built and sustained educational ' +
      'and civic institutions well beyond their own sanctuaries. Fifteenth Street’s 1870 basement ' +
      'classroom is one documented instance of that pattern; see Accepted claims below for ' +
      'statements specific to this record.',
    recordMaturity: 'partial_enrichment',
    researchCoverage: 'partial',
    mapPin: { x: 48, y: 42 },
    claims: [
      {
        id: 'claim_church_founded_1841',
        predicate: 'founded_year',
        object: '1841',
        confidenceScore: 0.85,
        confidenceLevel: confidenceLevel(0.85),
        citationSource: 'HMdb.org — historical marker database',
        citationHref: 'https://www.hmdb.org/m.asp?m=112661',
        citationLabel: 'Historical marker',
      },
      {
        id: 'claim_church_hosted_dunbar_founding_1870',
        predicate: 'hosted_founding_of',
        object: 'Preparatory High School for Colored Youth (1870), in the church basement',
        confidenceScore: 0.8,
        confidenceLevel: confidenceLevel(0.8),
        citationSource: 'Howard University Moorland-Spingarn Research Center — finding aid',
        citationHref: 'https://dh.howard.edu/finaid_manu/74/',
        citationLabel: 'Archival finding aid',
      },
    ],
    revision: revisionFor('2026-06-01T00:00:00.000Z'),
    relatedIds: ['ent_dunbar_school_001'],
    related: relatedEntriesFor('ent_15th_st_church_001'),
  },
  {
    id: 'ent_dunbar_school_001',
    kind: 'school',
    displayName: 'Paul Laurence Dunbar High School',
    summary:
      'Founded in 1870 as the Preparatory High School for Colored Youth, the nation’s first ' +
      'public high school for Black students, later renamed M Street High School (1891) and Paul ' +
      'Laurence Dunbar High School (1916).',
    era: 'reconstruction',
    ...(SCHOOL_STATUS !== undefined ? { status: SCHOOL_STATUS } : {}),
    ...(SCHOOL_STATUS_HISTORY !== undefined ? { statusHistory: SCHOOL_STATUS_HISTORY } : {}),
    ...(SCHOOL_SENSITIVITY !== undefined
      ? { sensitivityClass: SCHOOL_SENSITIVITY.class, sensitivity: SCHOOL_SENSITIVITY }
      : {}),
    eraBuckets: ['1870s', '1890s', '1910s'],
    notabilityLabels: [NOTABILITY_RUBRIC.first_to_do_x],
    topicTags: ['education', 'schools', 'preservation'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'campus',
    locationLabel: 'New Jersey Avenue NW campus, Truxton Circle (campus-level pin)',
    relevanceExplanation:
      'Included as the first public high school for Black students in the United States, with a ' +
      'documented multi-era campus history from its 1870 founding through today.',
    historicalContext:
      'The Preparatory High School for Colored Youth opened during Reconstruction, when Black ' +
      'communities in the District of Columbia built public schooling largely without support from ' +
      'the segregated municipal government. Renamed twice over the following decades, the ' +
      'school’s campus history reflects both that struggle and its long institutional continuity. ' +
      'See Accepted claims below for statements specific to this record.',
    extendedNarrative:
      'By the 1950s the school sent roughly 80% of its graduates on to college. Its faculty and ' +
      'administration included Mary Jane Patterson (the second African American woman to earn a ' +
      'college degree), Anna Julia Cooper (the fourth African American woman to earn a Ph.D.), ' +
      'Richard T. Greener (the first Black graduate of Harvard), Carter G. Woodson, Mary Church ' +
      'Terrell, and Robert Heberton Terrell. Graduates include physician Charles R. Drew, ' +
      'civil-rights lawyer Charles Hamilton Houston, and General Benjamin O. Davis Jr.',
    recordMaturity: 'partial_enrichment',
    researchCoverage: 'substantial',
    mapPin: { x: 55, y: 50 },
    claims: [
      {
        id: 'claim_dunbar_founded_1870',
        predicate: 'founded_as',
        object: 'Preparatory High School for Colored Youth (1870)',
        confidenceScore: 0.85,
        confidenceLevel: confidenceLevel(0.85),
        citationSource: 'DC Historic Sites — DC Preservation League',
        citationHref: 'https://historicsites.dcpreservation.org/items/show/162',
        citationLabel: 'Preservation register',
      },
      {
        id: 'claim_dunbar_renamed_m_street_1891',
        predicate: 'renamed_and_relocated',
        object: 'M Street High School (1891), permanent building',
        confidenceScore: 0.78,
        confidenceLevel: confidenceLevel(0.78),
        citationSource: 'Boundary Stones — WETA/PBS D.C. public history',
        citationHref:
          'https://boundarystones.weta.org/2024/11/14/dunbar-evolution-americas-first-black-public-high-school',
        citationLabel: 'Public history feature',
      },
      {
        id: 'claim_dunbar_renamed_dunbar_1916',
        predicate: 'renamed_and_relocated',
        object:
          'Paul Laurence Dunbar High School (1916), 1st & N Street NW, designed by architect Snowden Ashford',
        confidenceScore: 0.8,
        confidenceLevel: confidenceLevel(0.8),
        citationSource: 'Wikipedia — Dunbar High School (Washington, D.C.)',
        citationHref: 'https://en.wikipedia.org/wiki/Dunbar_High_School_(Washington,_D.C.)',
        citationLabel: 'Encyclopedia reference',
      },
      {
        id: 'claim_dunbar_demolitions_1977_2013',
        predicate: 'building_history',
        object:
          'The 1916 building was demolished in 1977; its 1970s replacement was itself demolished ' +
          'in 2013; the current building opened in 2013 on the same footprint',
        confidenceScore: 0.78,
        confidenceLevel: confidenceLevel(0.78),
        citationSource: 'National Trust for Historic Preservation',
        citationHref: 'https://savingplaces.org/stories/americas-first-african-american-public-high-school',
        citationLabel: 'Preservation feature',
      },
    ],
    revision: revisionFor('2026-06-15T00:00:00.000Z'),
    relatedIds: ['ent_15th_st_church_001'],
    related: relatedEntriesFor('ent_dunbar_school_001'),
  },
  {
    id: 'ent_dc_landmark_listing_1975',
    kind: 'event',
    displayName: 'D.C. Inventory of Historic Sites Listing (1975)',
    summary:
      'On April 29, 1975, Paul Laurence Dunbar High School was listed on the District of Columbia ' +
      'Inventory of Historic Sites, formally recognizing its standing as the nation’s first ' +
      'public high school for Black students.',
    era: 'late_20th_century',
    eventWindow: {
      startAt: '1975-04-29',
      endAt: null,
      datePrecision: 'day',
      eventType: 'landmark_designation',
    },
    eraBuckets: ['1970s'],
    notabilityLabels: [NOTABILITY_RUBRIC.landmark_or_national_register],
    topicTags: ['landmark', 'preservation', 'history'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'campus',
    locationLabel: 'Paul Laurence Dunbar High School campus (schematic)',
    relevanceExplanation:
      'Included as a formal landmark-designation event with documented listing evidence, tying the ' +
      'connected school’s historical significance to an official public record.',
    historicalContext:
      'Local historic-sites inventories across the country began formally recognizing Black ' +
      'educational and civic landmarks in the 1970s, often decades after similar recognition for ' +
      'other sites. This listing is one documented instance of that pattern for a Washington, D.C. ' +
      'institution. See Accepted claims below for statements specific to this record.',
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    mapPin: { x: 56, y: 51 },
    claims: [
      {
        id: 'claim_landmark_listed_1975',
        predicate: 'listed_on',
        object: 'D.C. Inventory of Historic Sites (April 29, 1975)',
        confidenceScore: 0.72,
        confidenceLevel: confidenceLevel(0.72),
        citationSource: 'DC Historic Sites — DC Preservation League',
        citationHref: 'https://historicsites.dcpreservation.org/items/show/162',
        citationLabel: 'Preservation register',
      },
    ],
    revision: revisionFor('2026-06-20T00:00:00.000Z'),
    relatedIds: ['ent_dunbar_school_001', 'ent_dunbar_alumni_federation_001'],
    related: relatedEntriesFor('ent_dc_landmark_listing_1975'),
  },
  {
    id: 'ent_dunbar_alumni_federation_001',
    kind: 'institution',
    displayName: 'Dunbar Alumni Federation',
    summary:
      'Organized in 2002 and tax-exempt as a 501(c)(3) nonprofit since July 2003, the Dunbar ' +
      'Alumni Federation preserves Paul Laurence Dunbar High School’s history and provides ' +
      'scholarship support to its students and alumni.',
    era: 'contemporary',
    ...(INSTITUTION_STATUS !== undefined ? { status: INSTITUTION_STATUS } : {}),
    ...(INSTITUTION_STATUS_HISTORY !== undefined ? { statusHistory: INSTITUTION_STATUS_HISTORY } : {}),
    eraBuckets: ['2000s'],
    notabilityLabels: [NOTABILITY_RUBRIC.community_anchor],
    topicTags: ['alumni', 'preservation', 'community'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'city',
    locationLabel: 'Washington, D.C. (city-level pin; no specific street address documented)',
    relevanceExplanation:
      'Included as a community-anchor institution with a documented, ongoing role preserving the ' +
      'connected school’s history and legacy.',
    historicalContext:
      'Alumni-led heritage organizations frequently form to document and sustain the legacy of ' +
      'long-standing Black educational institutions, especially after a physical campus changes ' +
      'significantly. This organization is one documented instance of that pattern. See Accepted ' +
      'claims below for statements specific to this record.',
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    mapPin: { x: 57, y: 52 },
    claims: [
      {
        id: 'claim_alumni_organized_2002',
        predicate: 'organized_year',
        object: '2002',
        confidenceScore: 0.75,
        confidenceLevel: confidenceLevel(0.75),
        citationSource: 'Dunbar Alumni Federation — About',
        citationHref: 'https://www.daf-dc.org/about-us',
        citationLabel: 'Organization self-report',
      },
      {
        id: 'claim_alumni_tax_exempt_2003',
        predicate: 'tax_exempt_since',
        object: 'July 2003 (IRS 501(c)(3))',
        confidenceScore: 0.82,
        confidenceLevel: confidenceLevel(0.82),
        citationSource: 'ProPublica Nonprofit Explorer',
        citationHref: 'https://projects.propublica.org/nonprofits/organizations/10712951',
        citationLabel: 'Nonprofit filing lookup',
      },
    ],
    revision: revisionFor('2026-07-01T00:00:00.000Z'),
    relatedIds: ['ent_dc_landmark_listing_1975'],
    related: relatedEntriesFor('ent_dunbar_alumni_federation_001'),
  },
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

export const FEATURED_SEED_IDS = ['ent_dunbar_school_001', 'ent_15th_st_church_001'] as const;

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
