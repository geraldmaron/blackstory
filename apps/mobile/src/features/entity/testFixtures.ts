/**
 * Fixture matrix for the entity detail screen (MOB-014).
 *
 * COVERAGE HONESTY (see this bead's final report for the full statement): the true
 * combinatorial space of "4 entity kinds × ~15 independently-optional entity fields × N
 * optional sub-fields per claim/timeline/related entry" is in the many thousands of
 * combinations. This file does NOT enumerate that space. It provides:
 *   - one FULL fixture per entity kind (every optional field populated, one of each
 *     enum value exercised somewhere across the four), and
 *   - one MINIMAL fixture (every optional field absent, for the "missing optional fields"
 *     adversarial case) per kind,
 *   - a set of targeted ADVERSARIAL fixtures, each isolating exactly one hostile input
 *     (malformed citation URL, invalid media rights, oversized narrative, self-referencing
 *     neighbor, malicious HTML/Unicode text, a claim with no citation, zero claims, an
 *     unrecognized enum value) — a representative sample chosen to hit every adversarial case
 *     this bead's brief names explicitly, not an exhaustive pairwise/combinatorial sweep.
 */
import { ENTITY_KINDS, type EntityKind } from './types';

/** Raw (pre-normalization) JSON shape — deliberately `Record<string, unknown>`, matching what
 * actually arrives over the wire/from cache (untyped at this boundary). */
export type RawEntity = Record<string, unknown>;

const BASE_REVISION = { releaseId: 'rel_2026_07_19_01', generatedAt: '2026-07-19T00:00:00.000Z', recordUpdatedAt: '2026-07-18T12:00:00.000Z' };

const BASE_CITATION = {
  source: 'Reputable Secondary',
  label: 'County historical register, vol. 4',
  href: 'https://example.org/sources/county-register-vol-4',
};

function fullClaim(id: string, overrides: RawEntity = {}): RawEntity {
  return {
    id,
    predicate: 'founded_by',
    object: 'Founded by a coalition of formerly enslaved families in 1871.',
    confidenceScore: 0.82,
    confidenceLevel: 'high',
    citation: BASE_CITATION,
    independentLineageCount: 3,
    dispute: {
      hasDispute: true,
      primaryValue: '1871',
      note: 'Two contemporaneous ledgers disagree on the founding year.',
      alternates: [
        { value: '1869', credible: true, kind: 'contradicting' },
        { value: '1872', credible: false, kind: 'alternative' },
      ],
    },
    revisionHistory: [
      { id: `${id}_rev1`, changedAt: '2025-01-01T00:00:00.000Z', changeKind: 'created', summary: 'Initial research pass.' },
      { id: `${id}_rev2`, changedAt: '2026-02-01T00:00:00.000Z', changeKind: 'corrected', summary: 'Corrected founding-year citation.' },
    ],
    ...overrides,
  };
}

function fullTimelineEvent(id: string, overrides: RawEntity = {}): RawEntity {
  return {
    id,
    atLabel: 'Circa 1871',
    at: '1871-01-01T00:00:00.000Z',
    datePrecision: 'circa',
    title: 'Founding',
    body: 'The community organizes and establishes the first structure on the site.',
    ...overrides,
  };
}

function fullNeighbor(id: string, overrides: RawEntity = {}): RawEntity {
  return {
    id,
    displayName: `Neighbor ${id}`,
    kind: 'institution',
    summary: 'A closely connected record in the published history graph.',
    relationType: 'founded_alongside',
    direction: 'outgoing',
    timespan: { label: 'Founding era', validFrom: '1871-01-01', validTo: null },
    ...overrides,
  };
}

/** A fully-populated entity for the given kind — every optional field present, one of each
 * enum represented somewhere in the fixture set. */
export function fullEntityFixture(kind: EntityKind, id = `ent_${kind}_full_001`): RawEntity {
  const isEvent = kind === 'event';
  return {
    id,
    kind,
    displayName: `Full Fixture Record (${kind})`,
    summary: 'A short summary of this record for the entity mast.',
    ...(isEvent ? {} : { status: 'active', statusHistory: [
      { status: 'active', validFrom: '1871-01-01', validTo: null, datePrecision: 'year', basisClaimIds: ['claim_1'] },
    ] }),
    ...(isEvent ? { eventWindow: { startAt: '1871-01-01', endAt: '1871-06-01', datePrecision: 'month', eventType: 'founding_ceremony' } } : {}),
    eraBuckets: ['reconstruction'],
    notabilityLabels: ['First of its kind in the county'],
    notabilityBasis: [{ criterion: 'firsts', note: 'First Black-owned institution of its kind in the county.', evidenceIds: ['claim_1'] }],
    sensitivityClass: 'ongoing_dispute',
    sensitivity: { class: 'ongoing_dispute', note: 'Some details of this record remain actively contested by descendant communities.', basisClaimIds: ['claim_1'] },
    topicTags: ['education', 'reconstruction_era'],
    topicIds: ['topic_education'],
    jurisdictionLabel: 'Dunbar County, GA',
    locationPrecision: 'neighborhood',
    locationLabel: 'Historic Dunbar neighborhood',
    relevanceExplanation: 'This record is included because it meets the documented-connection and notability bar for Black history.',
    historicalContext: 'Established during Reconstruction as part of a broader wave of community self-organization.',
    extendedNarrative: 'A longer passage of further reading for readers who want more than the summary and context provide.',
    primaryImage: {
      url: 'https://images.example.org/entities/full-001/primary.jpg',
      alt: 'Black-and-white archival photograph of the founding structure.',
      credit: 'County Historical Society Archive',
      rightsStatus: 'public_domain',
      width: 1600,
      height: 1200,
      objectPath: 'entities/full-001/primary.jpg',
    },
    recordMaturity: 'developing',
    researchCoverage: 'partial',
    geoAnchor: { lat: 33.749, lng: -84.388, geohash: 'dnh0', matchMethod: 'geocoded_jurisdiction' },
    claims: [fullClaim('claim_1'), fullClaim('claim_2', { dispute: undefined, citation: undefined, predicate: 'renamed_to' })],
    timeline: [fullTimelineEvent('tl_1'), fullTimelineEvent('tl_2', { atLabel: 'Undated', at: undefined, datePrecision: 'circa' })],
    revision: BASE_REVISION,
    related: [{ id: 'ent_related_1', type: 'founded_alongside', direction: 'outgoing' }],
    relatedNeighbors: [fullNeighbor('ent_neighbor_1'), fullNeighbor('ent_neighbor_2', { summary: '' })],
    continueLearning: [fullNeighbor('ent_continue_1')],
  };
}

/** Every OPTIONAL field genuinely absent (not present as a key at all) — only the fields the
 * wire schema marks required are present. Covers the "missing optional fields — screen still
 * renders sensibly, no crash" adversarial case for the given kind. */
export function minimalEntityFixture(kind: EntityKind, id = `ent_${kind}_minimal_001`): RawEntity {
  return {
    id,
    kind,
    displayName: `Minimal Fixture Record (${kind})`,
    summary: '',
    topicTags: [],
    jurisdictionLabel: 'Unknown jurisdiction',
    locationLabel: 'Unknown location',
    relevanceExplanation: '',
    historicalContext: '',
    recordMaturity: '',
    claims: [],
    timeline: [],
    revision: { releaseId: '', generatedAt: '', recordUpdatedAt: '' },
    // Deliberately no: status, statusHistory, eventWindow, eraBuckets, notabilityLabels,
    // notabilityBasis, sensitivityClass, sensitivity, topicIds, locationPrecision,
    // extendedNarrative, primaryImage, researchCoverage, geoAnchor, related, relatedNeighbors,
    // continueLearning.
  };
}

export const ALL_KINDS: readonly EntityKind[] = ENTITY_KINDS;

// ---------------------------------------------------------------------------
// Targeted adversarial fixtures
// ---------------------------------------------------------------------------

/** A claim whose citation carries a scheme this client must never open as a link. */
export function claimWithMalformedCitationUrl(): RawEntity {
  return fullClaim('claim_malformed_href', { citation: { source: 'Hostile source', label: 'Click here', href: 'javascript:alert(1)' } });
}

/** A claim with no citation at all (required on the wire, but a defensive fixture proves the
 * renderer tolerates its absence rather than crashing). */
export function claimWithNoCitation(): RawEntity {
  return fullClaim('claim_no_citation', { citation: undefined });
}

/** `primaryImage` with a `rightsStatus` outside the three cleared wire values — the concrete
 * "rights not cleared" simulation (the wire schema has no explicit "withheld" value; the
 * server simply omits the field when rights aren't cleared, so an unrecognized value here
 * models a corrupted/hostile payload that must still fail closed to a placeholder). */
export function entityWithUnclearedImageRights(): RawEntity {
  const base = fullEntityFixture('place', 'ent_place_rights_001');
  return {
    ...base,
    primaryImage: {
      url: 'https://images.example.org/entities/rights-001/primary.jpg',
      alt: 'A photograph.',
      credit: 'Someone',
      rightsStatus: 'withdrawn', // not a valid MediaRightsStatus
    },
  };
}

const LARGE_NARRATIVE = 'A'.repeat(100_000); // 5x the 20,000-char contract bound — large enough to
// prove the truncation guard engages, small enough not to make the RN test-renderer suite
// memory-hungry across many fixture renders in one process.

export function entityWithMaliciouslyLargeNarrative(): RawEntity {
  const base = fullEntityFixture('place', 'ent_place_large_001');
  return { ...base, extendedNarrative: LARGE_NARRATIVE };
}

const MALICIOUS_TEXT =
  '<script>alert(1)</script> ‮gnitset‬   ${process.env.SECRET} \'; DROP TABLE entities; --';

export function entityWithMaliciousText(): RawEntity {
  const base = fullEntityFixture('place', 'ent_place_malicious_001');
  return {
    ...base,
    displayName: `${MALICIOUS_TEXT} Place`,
    summary: MALICIOUS_TEXT,
    historicalContext: MALICIOUS_TEXT,
  };
}

/** A related-neighbor list containing an entry that references the ENTITY ITSELF — the
 * simplest concrete instance of a "cyclic related-entity graph" a flat, non-recursive renderer
 * must tolerate without looping. */
export function entityWithSelfReferencingNeighbor(): RawEntity {
  const id = 'ent_place_cycle_001';
  const base = fullEntityFixture('place', id);
  return {
    ...base,
    relatedNeighbors: [
      fullNeighbor(id, { displayName: 'Full Fixture Record (place)', relationType: 'self_reference' }),
      fullNeighbor('ent_other_side_of_cycle', { relationType: 'mutually_related' }),
    ],
  };
}

export function entityWithZeroClaims(): RawEntity {
  return { ...fullEntityFixture('place', 'ent_place_zero_claims_001'), claims: [] };
}

export function entityWithUnknownEnums(): RawEntity {
  const base = fullEntityFixture('place', 'ent_place_unknown_enum_001');
  return {
    ...base,
    kind: 'ghost-town', // not one of ENTITY_KINDS
    researchCoverage: 'exhaustive', // not a valid ResearchCoverage
    claims: [fullClaim('claim_bad_enum', { confidenceLevel: 'certain' })], // not a valid ConfidenceLevel
    timeline: [fullTimelineEvent('tl_bad_enum', { datePrecision: 'exact-second' })], // not a valid DatePrecision
  };
}
