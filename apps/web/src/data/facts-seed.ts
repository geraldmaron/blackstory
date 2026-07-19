/**
 * Sample `FactRecord` catalog for the fact registry web surfaces.
 *
 * Stands in for a real `publicReleases/{releaseId}/facts` projection the same way
 * `./public-seed.ts` stands in for the entity projection (see that file's own module doc for the
 * parallel convention). `subjects` deliberately reuse `./public-seed.ts`'s existing seed entity
 * ids (`ent_15th_st_church_001`, `ent_dunbar_school_001`, `ent_dc_landmark_listing_1975`,
 * `ent_dunbar_alumni_federation_001`) so a fact page and an entity page can genuinely link to the
 * SAME canonical record from both directions the owner's core "both surfaces linking to the same
 * reference info" requirement without inventing a parallel, disconnected entity catalog. This
 * file only ADDS facts; it never edits `./public-seed.ts` or `./entity-graph-seed.ts`.
 *
 * Every citation below is real (a genuine, checkable source URL from the research brief) and
 * carries a real Wayback Machine capture — `archivedUrl`/`archivedAt` were populated from a
 * lightweight `archive.org/wayback/available` lookup against each source URL, never a fabricated
 * snapshot, satisfying `assertFactCitationStructurallyComplete` (packages/domain/src/facts/citation.ts)
 * honestly instead of omitting the archive pointer.
 *
 * `derivedFromClaimIds`/`derivedFromRelationshipIds` (the related workstream): left empty for every
 * seed fact below. These facts were authored directly from the research brief, not derived from
 * a `CanonicalClaim` in `canonicalClaims/`, so there is no real claim id to backfill  guessing
 * one would be worse than leaving the link absent. An empty array is a documented no-op for
 * `packages/domain/src/facts/derivation.ts`'s consistency check, not a validation failure.
 */
import {
  asFactId,
  buildFactSearchIndexDocs,
  type FactRecord,
} from '@repo/domain';
import { NATIONAL_STORY_FACTS } from './national-story-seed/facts';

export const FACTS_SEED_RELEASE_ID = 'seed-release-2026-07-17';

const ACCESSED_AT = '2026-07-17T00:00:00.000Z';

export const SEED_FACTS: readonly FactRecord[] = [
  {
    id: asFactId('BB-F-000001'),
    slug: 'dunbar-founding-1870',
    statement:
      'In 1870, William Syphax, President of the Board of Trustees for Colored Schools, founded ' +
      'the Preparatory High School for Colored Youth — the first public high school for Black ' +
      'students in the United States — in the basement of Fifteenth Street Presbyterian Church, ' +
      'with 45 students and one teacher, Emma J. Hutchins.',
    shortStatement: 'Dunbar founded 1870 in church basement',
    claimType: 'event',
    subjects: [
      { entityId: 'ent_dunbar_school_001', kind: 'school', role: 'primary-subject' },
      { entityId: 'ent_15th_st_church_001', kind: 'place', role: 'location' },
    ],
    geo: { lat: 38.9126, lng: -77.0366, geoPrecision: 'locality' },
    when: { validFrom: '1870', datePrecision: 'year' },
    qualifiers: [],
    counterClaims: [],
    relatedFacts: [{ factId: 'BB-F-000002', type: 'partOf' }],
    derivedFromClaimIds: [],
    derivedFromRelationshipIds: [],
    provenance: {
      researchedBy: 'seed-catalog',
      reviewedBy: 'seed-catalog-editorial',
      reviewedAt: '2026-07-16T00:00:00.000Z',
      method: 'primary-source-review',
    },
    status: 'published',
    confidence: 'established',
    citations: [
      {
        csl: {
          id: 'csl-blackpast-dunbar-founding',
          type: 'webpage',
          title: 'Paul Laurence Dunbar High School (1870- )',
          publisher: 'BlackPast.org',
          URL: 'https://blackpast.org/african-american-history/paul-laurence-dunbar-high-school-1870/',
        },
        sourceClass: 'secondary',
        role: 'supports',
        excerpt:
          'Documents the 1870 founding as the Preparatory High School for Colored Youth, with William ' +
          'Syphax as founder and Emma J. Hutchins as the first teacher.',
        archivedUrl:
          'https://web.archive.org/web/20251013100723/https://blackpast.org/african-american-history/paul-laurence-dunbar-high-school-1870/',
        archivedAt: '2025-10-13T10:07:23.000Z',
        accessedAt: ACCESSED_AT,
      },
      {
        csl: {
          id: 'csl-dcpreservation-dunbar-register',
          type: 'webpage',
          title: 'Paul Laurence Dunbar Senior High School',
          publisher: 'DC Historic Sites (DC Preservation League)',
          URL: 'https://historicsites.dcpreservation.org/items/show/162',
        },
        sourceClass: 'secondary',
        role: 'supports',
        excerpt: 'Register entry documenting the school’s 1870 founding and subsequent campus history.',
        archivedUrl: 'https://web.archive.org/web/20251022224308/https://historicsites.dcpreservation.org/items/show/162',
        archivedAt: '2025-10-22T22:43:08.000Z',
        accessedAt: ACCESSED_AT,
      },
      {
        csl: {
          id: 'csl-nps-dunbar-founding',
          type: 'webpage',
          title: 'Paul Laurence Dunbar High School',
          publisher: 'National Park Service',
          URL: 'https://www.nps.gov/places/paul-laurence-dunbar-high-school.htm',
        },
        sourceClass: 'primary',
        role: 'supports',
        excerpt: 'Government places page corroborating the 1870 founding as the first Black public high school.',
        archivedUrl: 'https://web.archive.org/web/20250908163726/https://www.nps.gov/places/paul-laurence-dunbar-high-school.htm',
        archivedAt: '2025-09-08T16:37:26.000Z',
        accessedAt: ACCESSED_AT,
      },
    ],
    revisions: [
      {
        revisionNumber: 1,
        timestamp: '2026-07-10T00:00:00.000Z',
        agent: { id: 'seed-catalog', type: 'system', displayName: 'Seed catalog' },
        changeType: 'update',
        summary: 'Initial publication from the primary-source review.',
        diff: [],
      },
    ],
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  },
  {
    id: asFactId('BB-F-000002'),
    slug: 'm-street-rename-1891',
    statement:
      'In 1891, the school moved to a permanent building and was renamed M Street High School.',
    shortStatement: 'Renamed M Street High School, 1891',
    claimType: 'place-designation',
    subjects: [{ entityId: 'ent_dunbar_school_001', kind: 'school', role: 'primary-subject' }],
    geo: { lat: 38.9072, lng: -77.0369, geoPrecision: 'locality' },
    when: { validFrom: '1891', datePrecision: 'year' },
    qualifiers: [
      {
        kind: 'estimated',
        key: 'building-address',
        value: 'Exact street address of the M Street building not documented in sources consulted this session',
      },
    ],
    counterClaims: [],
    relatedFacts: [{ factId: 'BB-F-000001', type: 'partOf' }],
    derivedFromClaimIds: [],
    derivedFromRelationshipIds: [],
    provenance: { researchedBy: 'seed-catalog', method: 'secondary-source-review' },
    status: 'published',
    confidence: 'corroborated',
    citations: [
      {
        csl: {
          id: 'csl-wikipedia-dunbar-m-street',
          type: 'webpage',
          title: 'Dunbar High School (Washington, D.C.)',
          publisher: 'Wikipedia',
          URL: 'https://en.wikipedia.org/wiki/Dunbar_High_School_(Washington,_D.C.)',
        },
        sourceClass: 'secondary',
        role: 'supports',
        excerpt: 'Describes the 1891 move to a permanent building and the renaming to M Street High School.',
        archivedUrl:
          'https://web.archive.org/web/20260621174356/https://en.wikipedia.org/wiki/Dunbar_High_School_%28Washington,_D.C.%29',
        archivedAt: '2026-06-21T17:43:56.000Z',
        accessedAt: ACCESSED_AT,
      },
      {
        csl: {
          id: 'csl-boundarystones-m-street',
          type: 'webpage',
          title: 'Dunbar Evolution: America’s First Black Public High School',
          publisher: 'Boundary Stones (WETA/PBS)',
          URL: 'https://boundarystones.weta.org/2024/11/14/dunbar-evolution-americas-first-black-public-high-school',
        },
        sourceClass: 'secondary',
        role: 'supports',
        excerpt: 'D.C. public-history feature tracing the school’s campus evolution, including the 1891 M Street building.',
        archivedUrl:
          'https://web.archive.org/web/20260416150835/https://boundarystones.weta.org/2024/11/14/dunbar-evolution-americas-first-black-public-high-school',
        archivedAt: '2026-04-16T15:08:35.000Z',
        accessedAt: ACCESSED_AT,
      },
    ],
    revisions: [
      {
        revisionNumber: 1,
        timestamp: '2026-07-10T00:00:00.000Z',
        agent: { id: 'seed-catalog', type: 'system', displayName: 'Seed catalog' },
        changeType: 'update',
        summary: 'Initial publication from the secondary-source review.',
        diff: [],
      },
    ],
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
  },
  {
    id: asFactId('BB-F-000003'),
    slug: 'dunbar-rename-1916',
    statement:
      'In 1916, the school moved to a new building at 1st and N Streets NW (now 1301 New Jersey ' +
      'Avenue NW), designed by architect Snowden Ashford, and was renamed Paul Laurence Dunbar ' +
      'High School after the poet.',
    shortStatement: 'Renamed Paul Laurence Dunbar High School, 1916',
    claimType: 'place-designation',
    subjects: [{ entityId: 'ent_dunbar_school_001', kind: 'school', role: 'primary-subject' }],
    geo: { lat: 38.9098, lng: -77.0143, geoPrecision: 'block' },
    when: { validFrom: '1916', datePrecision: 'year' },
    qualifiers: [],
    counterClaims: [
      {
        misreading: 'Dunbar has always been called Dunbar High School.',
        refutation:
          'The school operated under two earlier names before 1916: Preparatory High School for ' +
          'Colored Youth (1870–1891) and M Street High School (1891–1916).',
      },
    ],
    relatedFacts: [{ factId: 'BB-F-000002', type: 'partOf' }],
    derivedFromClaimIds: [],
    derivedFromRelationshipIds: [],
    provenance: {
      researchedBy: 'seed-catalog',
      reviewedBy: 'seed-catalog-editorial',
      reviewedAt: '2026-07-14T00:00:00.000Z',
      method: 'secondary-source-review',
    },
    status: 'published',
    confidence: 'established',
    confidenceNote:
      'Corroborated by both an encyclopedia reference and the National Park Service’s places record.',
    citations: [
      {
        csl: {
          id: 'csl-wikipedia-dunbar-1916',
          type: 'webpage',
          title: 'Dunbar High School (Washington, D.C.)',
          publisher: 'Wikipedia',
          URL: 'https://en.wikipedia.org/wiki/Dunbar_High_School_(Washington,_D.C.)',
        },
        sourceClass: 'secondary',
        role: 'supports',
        excerpt: 'Describes the 1916 move and renaming to Paul Laurence Dunbar High School, with architect Snowden Ashford.',
        archivedUrl:
          'https://web.archive.org/web/20260621174356/https://en.wikipedia.org/wiki/Dunbar_High_School_%28Washington,_D.C.%29',
        archivedAt: '2026-06-21T17:43:56.000Z',
        accessedAt: ACCESSED_AT,
      },
      {
        csl: {
          id: 'csl-nps-dunbar-1916',
          type: 'webpage',
          title: 'Paul Laurence Dunbar High School',
          publisher: 'National Park Service',
          URL: 'https://www.nps.gov/places/paul-laurence-dunbar-high-school.htm',
        },
        sourceClass: 'primary',
        role: 'supports',
        excerpt: 'Government places page corroborating the 1916 building and renaming after the poet.',
        archivedUrl: 'https://web.archive.org/web/20250908163726/https://www.nps.gov/places/paul-laurence-dunbar-high-school.htm',
        archivedAt: '2025-09-08T16:37:26.000Z',
        accessedAt: ACCESSED_AT,
      },
    ],
    revisions: [
      {
        revisionNumber: 1,
        timestamp: '2026-07-10T00:00:00.000Z',
        agent: { id: 'seed-catalog', type: 'system', displayName: 'Seed catalog' },
        changeType: 'update',
        summary: 'Initial publication from Wikipedia alone.',
        diff: [],
      },
      {
        revisionNumber: 2,
        timestamp: '2026-07-14T00:00:00.000Z',
        agent: { id: 'seed-catalog-editorial', type: 'user', displayName: 'Editorial review' },
        changeType: 'update',
        summary:
          'Added the NPS Places record as a second, independent corroborating citation, upgrading ' +
          'confidence from single-source to established.',
        diff: [
          { field: 'confidence', before: 'single-source', after: 'established' },
          { field: 'citations', before: '1 citation (Wikipedia)', after: '2 citations (Wikipedia, NPS)' },
        ],
      },
    ],
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
  },
  {
    id: asFactId('BB-F-000004'),
    slug: 'dc-historic-inventory-1975',
    statement:
      'On April 29, 1975, Paul Laurence Dunbar High School was listed on the District of Columbia ' +
      'Inventory of Historic Sites.',
    shortStatement: 'Listed on D.C. Historic Sites Inventory, 1975',
    claimType: 'place-designation',
    subjects: [
      { entityId: 'ent_dc_landmark_listing_1975', kind: 'event', role: 'primary-event' },
      { entityId: 'ent_dunbar_school_001', kind: 'school', role: 'location' },
    ],
    geo: { lat: 38.9098, lng: -77.0143, geoPrecision: 'block' },
    when: { validFrom: '1975-04-29', datePrecision: 'day' },
    qualifiers: [],
    counterClaims: [],
    relatedFacts: [{ factId: 'BB-F-000007', type: 'contextualizes' }],
    derivedFromClaimIds: [],
    derivedFromRelationshipIds: [],
    provenance: {
      researchedBy: 'seed-catalog',
      reviewedBy: 'seed-catalog-editorial',
      reviewedAt: '2026-07-13T00:00:00.000Z',
      method: 'primary-source-review',
    },
    status: 'corrected',
    confidence: 'single-source',
    confidenceNote:
      'Only the DC Preservation League’s own historicsites.dcpreservation.org record could be ' +
      'traced to a citable primary page for this date. A separate secondary snippet referencing a ' +
      '1986 National Register of Historic Places listing could not be verified against a primary ' +
      'source this session and is not included in this record (see BB-F-000007 for that open item).',
    citations: [
      {
        csl: {
          id: 'csl-dcpreservation-dunbar-1975-listing',
          type: 'webpage',
          title: 'Paul Laurence Dunbar Senior High School',
          publisher: 'DC Historic Sites (DC Preservation League)',
          URL: 'https://historicsites.dcpreservation.org/items/show/162',
        },
        sourceClass: 'primary',
        role: 'supports',
        excerpt: 'Register entry recording the April 29, 1975 D.C. Inventory of Historic Sites listing date.',
        archivedUrl: 'https://web.archive.org/web/20251022224308/https://historicsites.dcpreservation.org/items/show/162',
        archivedAt: '2025-10-22T22:43:08.000Z',
        accessedAt: ACCESSED_AT,
      },
    ],
    revisions: [
      {
        revisionNumber: 1,
        timestamp: '2026-07-12T00:00:00.000Z',
        agent: { id: 'seed-catalog', type: 'system', displayName: 'Seed catalog' },
        changeType: 'update',
        summary:
          'Initial publication citing an uncited secondary aggregator’s figure of a 1978 D.C. ' +
          'inventory listing date.',
        diff: [],
      },
      {
        revisionNumber: 2,
        timestamp: '2026-07-13T00:00:00.000Z',
        agent: { id: 'seed-catalog-editorial', type: 'user', displayName: 'Editorial review' },
        changeType: 'correction',
        summary:
          'Corrected the D.C. Inventory of Historic Sites listing date from an uncited secondary ' +
          'aggregator’s 1978 figure to April 29, 1975, per the DC Preservation League’s own ' +
          'historicsites.dcpreservation.org register record.',
        diff: [
          { field: 'when.validFrom', before: '1978', after: '1975-04-29' },
          { field: 'confidence', before: 'single-source', after: 'single-source' },
        ],
      },
    ],
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  },
  {
    id: asFactId('BB-F-000005'),
    slug: 'dunbar-campus-rebuild-2013',
    statement:
      'The school’s 1916 building was demolished in 1977, and its 1970s replacement was itself ' +
      'demolished in 2013; the current building, opened in 2013, honors the school’s history ' +
      'through its original footprint, plaques of notable graduates, and paintings of alumni who ' +
      'appeared on U.S. postage stamps, rather than preserving the original structure.',
    shortStatement: '1916 and 1970s buildings demolished, rebuilt 2013',
    claimType: 'event',
    subjects: [{ entityId: 'ent_dunbar_school_001', kind: 'school', role: 'primary-subject' }],
    geo: { lat: 38.9098, lng: -77.0143, geoPrecision: 'block' },
    when: { validFrom: '1977', validTo: '2013', datePrecision: 'year' },
    qualifiers: [],
    counterClaims: [
      {
        misreading: 'The Dunbar building students and alumni visit today is the original 1916 building.',
        refutation:
          'The 1916 building was demolished in 1977; its 1970s replacement was itself demolished in ' +
          '2013. The current building, opened in 2013, sits on the same footprint but is a new ' +
          'structure.',
      },
    ],
    relatedFacts: [{ factId: 'BB-F-000003', type: 'contextualizes' }],
    derivedFromClaimIds: [],
    derivedFromRelationshipIds: [],
    provenance: {
      researchedBy: 'seed-catalog',
      reviewedBy: 'seed-catalog-editorial',
      reviewedAt: '2026-07-15T00:00:00.000Z',
      method: 'secondary-source-review',
    },
    status: 'published',
    confidence: 'corroborated',
    citations: [
      {
        csl: {
          id: 'csl-savingplaces-dunbar-demolitions',
          type: 'webpage',
          title: 'America’s First African American Public High School',
          publisher: 'National Trust for Historic Preservation',
          URL: 'https://savingplaces.org/stories/americas-first-african-american-public-high-school',
        },
        sourceClass: 'secondary',
        role: 'supports',
        excerpt:
          'Recounts the 1977 and 2013 demolitions, alumni reaction, and how the 2013 building honors ' +
          'the school’s history without preserving the original fabric.',
        archivedUrl:
          'https://web.archive.org/web/20260402051928/https://savingplaces.org/stories/americas-first-african-american-public-high-school',
        archivedAt: '2026-04-02T05:19:28.000Z',
        accessedAt: ACCESSED_AT,
      },
      {
        csl: {
          id: 'csl-boundarystones-dunbar-demolitions',
          type: 'webpage',
          title: 'Dunbar Evolution: America’s First Black Public High School',
          publisher: 'Boundary Stones (WETA/PBS)',
          URL: 'https://boundarystones.weta.org/2024/11/14/dunbar-evolution-americas-first-black-public-high-school',
        },
        sourceClass: 'secondary',
        role: 'supports',
        excerpt: 'D.C. public-history feature covering the building’s demolition and rebuilding history through 2013.',
        archivedUrl:
          'https://web.archive.org/web/20260416150835/https://boundarystones.weta.org/2024/11/14/dunbar-evolution-americas-first-black-public-high-school',
        archivedAt: '2026-04-16T15:08:35.000Z',
        accessedAt: ACCESSED_AT,
      },
    ],
    revisions: [
      {
        revisionNumber: 1,
        timestamp: '2026-07-15T00:00:00.000Z',
        agent: { id: 'seed-catalog', type: 'system', displayName: 'Seed catalog' },
        changeType: 'update',
        summary: 'Initial publication from the secondary-source review.',
        diff: [],
      },
    ],
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  },
  {
    id: asFactId('BB-F-000006'),
    slug: 'alumni-federation-2002',
    statement:
      'The Dunbar Alumni Federation was organized in 2002 in the District of Columbia as a ' +
      '501(c)(3) nonprofit corporation, tax-exempt since July 2003, to preserve the school’s ' +
      'history and provide scholarship and financial support to Dunbar students and alumni.',
    shortStatement: 'Dunbar Alumni Federation organized, 2002',
    claimType: 'event',
    subjects: [{ entityId: 'ent_dunbar_alumni_federation_001', kind: 'institution', role: 'primary-subject' }],
    geo: { lat: 38.9072, lng: -77.0369, geoPrecision: 'locality' },
    when: { validFrom: '2002', datePrecision: 'year' },
    qualifiers: [],
    counterClaims: [],
    relatedFacts: [{ factId: 'BB-F-000004', type: 'contextualizes' }],
    derivedFromClaimIds: [],
    derivedFromRelationshipIds: [],
    provenance: { researchedBy: 'seed-catalog', method: 'primary-source-review' },
    status: 'published',
    confidence: 'corroborated',
    citations: [
      {
        csl: {
          id: 'csl-dafdc-about',
          type: 'webpage',
          title: 'About Us',
          publisher: 'Dunbar Alumni Federation',
          URL: 'https://www.daf-dc.org/about-us',
        },
        sourceClass: 'primary',
        role: 'supports',
        excerpt: 'The organization’s own account of its 2002 founding and its scholarship and preservation mission.',
        archivedUrl: 'https://web.archive.org/web/20250516030534/https://www.daf-dc.org/about-us',
        archivedAt: '2025-05-16T03:05:34.000Z',
        accessedAt: ACCESSED_AT,
      },
      {
        csl: {
          id: 'csl-propublica-dunbar-alumni',
          type: 'webpage',
          title: 'Dunbar Alumni Federation Inc — Nonprofit Explorer',
          publisher: 'ProPublica',
          URL: 'https://projects.propublica.org/nonprofits/organizations/10712951',
        },
        sourceClass: 'secondary',
        role: 'supports',
        excerpt: 'Independent nonprofit-filing lookup corroborating the organization’s 501(c)(3) tax-exempt status.',
        archivedUrl:
          'https://web.archive.org/web/20250807134434/https://projects.propublica.org/nonprofits/organizations/10712951',
        archivedAt: '2025-08-07T13:44:34.000Z',
        accessedAt: ACCESSED_AT,
      },
    ],
    revisions: [
      {
        revisionNumber: 1,
        timestamp: '2026-07-16T00:00:00.000Z',
        agent: { id: 'seed-catalog', type: 'system', displayName: 'Seed catalog' },
        changeType: 'update',
        summary: 'Initial publication from the primary-source review.',
        diff: [],
      },
    ],
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  },
  {
    id: asFactId('BB-F-000007'),
    slug: 'draft-nrhp-date',
    statement:
      'Draft: at least one secondary aggregator references a separate National Register of ' +
      'Historic Places listing for the school dated 1986; this date has not yet been ' +
      'independently verified against a primary National Register source and is not yet part of ' +
      'the published record.',
    shortStatement: 'Draft: NRHP listing date unverified',
    claimType: 'quantity',
    subjects: [{ entityId: 'ent_dc_landmark_listing_1975', kind: 'event', role: 'subject' }],
    qualifiers: [],
    counterClaims: [],
    relatedFacts: [{ factId: 'BB-F-000004', type: 'contextualizes' }],
    derivedFromClaimIds: [],
    derivedFromRelationshipIds: [],
    provenance: { researchedBy: 'seed-catalog', method: 'secondary-source-triage' },
    status: 'draft',
    confidence: 'single-source',
    confidenceNote:
      'Only a secondary aggregator snippet references this date; no primary National Register ' +
      'source was located this session, so this record stays in draft rather than being published.',
    citations: [],
    revisions: [],
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  },
  ...NATIONAL_STORY_FACTS,
] as const;

export function getSeedFact(id: string): FactRecord | undefined {
  return SEED_FACTS.find((fact) => fact.id === id);
}

export function listSeedFacts(): readonly FactRecord[] {
  return SEED_FACTS;
}

/** Facts naming `entityId` as a subject input for entity-page CompactFactReference embeds.  */
export function seedFactsForEntity(entityId: string): readonly FactRecord[] {
  return SEED_FACTS.filter((fact) => fact.subjects.some((subject) => subject.entityId === entityId));
}

/** The lane hook applied to this seed catalog the same real
 * `buildFactSearchIndexDocs` a live release build would call. */
export function getSeedFactSearchIndex() {
  return buildFactSearchIndexDocs(FACTS_SEED_RELEASE_ID, SEED_FACTS);
}
