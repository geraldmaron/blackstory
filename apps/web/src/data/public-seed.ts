/**
 * Public-facing seed catalog for the web UI.
 * Mirrors safe fields from packages/firebase/fixtures/firestore-seed.ts for
 * demonstrable pages until BB-019 public projections and BB-049 search land.
 * Never includes residential addresses or unpublished high-impact claims.
 */

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

export type PublicTimelineEvent = {
  readonly id: string;
  readonly time: string;
  readonly title: string;
  readonly body: string;
};

export type PublicEntityView = {
  readonly id: string;
  readonly kind: PublicEntityKind;
  readonly displayName: string;
  readonly summary: string;
  readonly era: string;
  readonly topicTags: readonly string[];
  readonly jurisdictionLabel: string;
  /** City / campus / neighborhood — never street or residence. */
  readonly locationPrecision: 'city' | 'neighborhood' | 'campus' | 'institution';
  readonly locationLabel: string;
  readonly relevanceExplanation: string;
  readonly recordMaturity: string;
  readonly researchCoverage: 'minimal' | 'partial' | 'substantial';
  readonly mapPin: { readonly x: number; readonly y: number };
  readonly claims: readonly PublicClaimView[];
  readonly timeline: readonly PublicTimelineEvent[];
  readonly relatedIds: readonly string[];
};

function confidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Seed entities aligned with firestore-seed public projections (place + school).
 * Person fixtures are intentionally omitted from public browse (BB-015 living-person).
 */
export const PUBLIC_SEED_ENTITIES: readonly PublicEntityView[] = [
  {
    id: 'ent_seed_place_001',
    kind: 'place',
    displayName: 'Seed Historical Place',
    summary:
      'Fixture projection for a historically documented Black community place in the District of Columbia area.',
    era: 'reconstruction',
    topicTags: ['community', 'education', 'reconstruction'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'city',
    locationLabel: 'Washington, D.C. (city-level pin)',
    relevanceExplanation:
      'Included because archival records connect this place to Black educational and community history with accepted, published claims above the constitution relevance threshold. Sample seed data — not a live public release.',
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
    ],
    timeline: [
      {
        id: 'tl_place_1867',
        time: '1867',
        title: 'Documented founding year (accepted claim)',
        body: 'Accepted claim object: 1867. Competing evidence asserts 1868.',
      },
      {
        id: 'tl_place_1920',
        time: '1920–1950',
        title: 'Historical neighborhood extent',
        body: 'Approximate neighborhood geometry — not a parcel or residential address.',
      },
      {
        id: 'tl_place_1950',
        time: '1950–present',
        title: 'Current city-level map context',
        body: 'Public pin limited to city precision per product constitution.',
      },
    ],
    relatedIds: ['ent_seed_school_001'],
  },
  {
    id: 'ent_seed_school_001',
    kind: 'school',
    displayName: 'Seed Freedmen School',
    summary:
      'School with documented historical and current campus locations (campus precision only).',
    era: 'reconstruction',
    topicTags: ['education', 'freedmen', 'schools'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'campus',
    locationLabel: 'Campus extent (schematic)',
    relevanceExplanation:
      'Qualifies as a place-connected educational institution with multi-era campus history tied to Black public schooling. Sample seed data pending BB-019 projection builders.',
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    mapPin: { x: 55, y: 50 },
    claims: [],
    timeline: [
      {
        id: 'tl_school_1868',
        time: '1868',
        title: 'Opened as Colored School No. 1',
        body: 'Former name recorded as an alias with a validity window.',
      },
      {
        id: 'tl_school_1910',
        time: '1910',
        title: 'Primary name: Seed Freedmen School',
        body: 'Name change documented in seed school status history.',
      },
      {
        id: 'tl_school_1954',
        time: '1954',
        title: 'Campus relocation',
        body: 'Historical campus closed; current campus role begins (campus precision).',
      },
    ],
    relatedIds: ['ent_seed_place_001'],
  },
] as const;

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
