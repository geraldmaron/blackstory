/**
 * Sample `FactRecord` catalog for the fact registry web surfaces.
 *
 * Stands in for a real `publicReleases/{releaseId}/facts` projection the same way
 * `./public-seed.ts` stands in for the entity projection (see that file's own module doc for the
 * parallel convention). `subjects` deliberately reuse `./public-seed.ts`'s existing seed entity
 * ids (`ent_seed_place_001`, `ent_seed_school_001`, `ent_seed_event_001`,
 * `ent_seed_institution_001`) so a fact page and an entity page can genuinely link to the SAME
 * canonical record from both directions the owner's core "both surfaces linking to the same
 * reference info" requirement without inventing a parallel, disconnected entity catalog. This
 * file only ADDS facts; it never edits `./public-seed.ts` or `./entity-graph-seed.ts`.
 */
import {
  asFactId,
  buildFactSearchIndexDocs,
  type FactRecord,
} from '@black-book/domain';
import { NATIONAL_STORY_FACTS } from './national-story-seed/facts';

export const FACTS_SEED_RELEASE_ID = 'seed-release-2026-07-17';

export const SEED_FACTS: readonly FactRecord[] = [
  {
    id: asFactId('BB-F-000001'),
    slug: 'rosa-parks-arrested-december-1-1955',
    statement:
      'On December 1, 1955, Rosa Parks was arrested in Montgomery, Alabama, for refusing to give up her bus seat to a white passenger, an act that helped spark the Montgomery Bus Boycott.',
    shortStatement: 'Rosa Parks arrested, Dec. 1, 1955',
    claimType: 'event',
    subjects: [
      { entityId: 'ent_seed_event_001', kind: 'event', role: 'primary-event' },
      { entityId: 'ent_seed_place_001', kind: 'place', role: 'location' },
    ],
    geo: { lat: 32.3792, lng: -86.3077, geoPrecision: 'locality' },
    when: { validFrom: '1955-12-01', datePrecision: 'day' },
    qualifiers: [
      { kind: 'as-reported-by', key: 'arresting-officer-report', value: 'Montgomery Police Department log, Dec. 1, 1955' },
    ],
    counterClaims: [
      {
        misreading: 'Rosa Parks was simply "tired" that day and acted spontaneously with no prior activism.',
        refutation:
          'Parks was an active NAACP secretary who had trained in nonviolent resistance at the Highlander Folk School; her refusal was a deliberate act, not an impulsive one.',
      },
    ],
    relatedFacts: [],
    provenance: {
      researchedBy: 'seed-catalog',
      reviewedBy: 'seed-catalog-editorial',
      reviewedAt: '2026-07-10T00:00:00.000Z',
      method: 'primary-source-review',
    },
    status: 'published',
    confidence: 'established',
    citations: [
      {
        csl: {
          id: 'csl-mia-chronology',
          type: 'webpage',
          title: 'Montgomery Improvement Association chronology',
          URL: 'https://example.gov/archives/mia-chronology',
        },
        sourceClass: 'primary',
        role: 'supports',
        excerpt: 'On December 1, 1955, Mrs. Rosa Parks was arrested for violating the city bus segregation ordinance.',
        archivedUrl: 'https://web.archive.org/web/20260101000000/https://example.gov/archives/mia-chronology',
        archivedAt: '2026-01-01T00:00:00.000Z',
        accessedAt: '2026-01-05T00:00:00.000Z',
        documentId: 'doc-mia-chronology-001',
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
    updatedAt: '2026-07-10T00:00:00.000Z',
  },
  {
    id: asFactId('BB-F-000002'),
    slug: 'school-founded-as-freedmens-school-1868',
    statement:
      'The school now on this site was founded in 1868 as a Freedmen\u2019s Bureau school serving formerly enslaved children in the years immediately following emancipation.',
    shortStatement: 'School founded as Freedmen\u2019s school, 1868',
    claimType: 'place-designation',
    subjects: [{ entityId: 'ent_seed_school_001', kind: 'school', role: 'designated-place' }],
    geo: { lat: 33.749, lng: -84.388, geoPrecision: 'block' },
    when: { validFrom: '1868', datePrecision: 'year' },
    qualifiers: [{ kind: 'estimated', key: 'founding-month', value: 'exact month not recorded in surviving registers' }],
    counterClaims: [],
    relatedFacts: [],
    provenance: {
      researchedBy: 'seed-catalog',
      method: 'archival-record-review',
    },
    status: 'published',
    confidence: 'corroborated',
    citations: [
      {
        csl: {
          id: 'csl-freedmens-bureau-register',
          type: 'book',
          title: 'Freedmen\u2019s Bureau school registers, Georgia district',
        },
        sourceClass: 'primary',
        role: 'supports',
        excerpt: 'School established 1868 under Freedmen\u2019s Bureau authorization, district register entry 214.',
        accessedAt: '2026-02-01T00:00:00.000Z',
        sourceNote: 'Consulted via microfilm at the state archives; no stable URL exists for this record.',
      },
    ],
    revisions: [
      {
        revisionNumber: 1,
        timestamp: '2026-07-10T00:00:00.000Z',
        agent: { id: 'seed-catalog', type: 'system', displayName: 'Seed catalog' },
        changeType: 'update',
        summary: 'Initial publication from the archival register review.',
        diff: [],
      },
    ],
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
  },
  {
    id: asFactId('BB-F-000003'),
    slug: 'institution-attendance-figure-corrected',
    statement:
      'The institution\u2019s founding-year attendance is documented at approximately 1,200 members, corrected from an earlier estimate of 3,000 that appeared in a single secondary source.',
    shortStatement: 'Founding attendance ~1,200, corrected from ~3,000',
    claimType: 'quantity',
    subjects: [{ entityId: 'ent_seed_institution_001', kind: 'institution', role: 'subject' }],
    when: { validFrom: '1975', datePrecision: 'year' },
    qualifiers: [{ kind: 'estimated', key: 'attendance-method', value: 'contemporaneous membership rolls, not a headcount' }],
    counterClaims: [
      {
        misreading: 'The institution had 3,000 founding members.',
        refutation:
          'That figure traces to a single 1980s newspaper retrospective with no cited source; the institution\u2019s own membership rolls from 1975 document approximately 1,200.',
      },
    ],
    relatedFacts: [],
    provenance: {
      researchedBy: 'seed-catalog',
      reviewedBy: 'seed-catalog-editorial',
      reviewedAt: '2026-07-12T00:00:00.000Z',
      method: 'membership-roll-cross-check',
    },
    status: 'corrected',
    confidence: 'contested',
    confidenceNote:
      'A single secondary source (a 1980s retrospective) states 3,000; the primary membership rolls document ~1,200. This record follows the primary source and discloses the discrepancy rather than silently dropping it.',
    citations: [
      {
        csl: {
          id: 'csl-membership-rolls-1975',
          type: 'manuscript',
          title: 'Institution membership rolls, 1975',
        },
        sourceClass: 'primary',
        role: 'supports',
        excerpt: 'Membership roll, 1975: 1,187 recorded members as of the founding assembly.',
        accessedAt: '2026-02-10T00:00:00.000Z',
        sourceNote: 'Held in the institution\u2019s own archive; no stable URL exists for this record.',
      },
      {
        csl: {
          id: 'csl-1980s-retrospective',
          type: 'article-newspaper',
          title: 'Retrospective feature citing 3,000 founding members',
          URL: 'https://example-news.example/retrospective-1980s',
        },
        sourceClass: 'secondary',
        role: 'contradicts',
        excerpt: 'The institution welcomed some 3,000 members at its founding, the article recalled.',
        archivedUrl: 'https://web.archive.org/web/20260201000000/https://example-news.example/retrospective-1980s',
        archivedAt: '2026-02-01T00:00:00.000Z',
        accessedAt: '2026-02-10T00:00:00.000Z',
        sourceNote: 'Cited here as the contradicting source this record\u2019s correction resolves, not as support.',
      },
    ],
    revisions: [
      {
        revisionNumber: 1,
        timestamp: '2026-07-01T00:00:00.000Z',
        agent: { id: 'seed-catalog', type: 'system', displayName: 'Seed catalog' },
        changeType: 'update',
        summary: 'Initial publication, following the 1980s retrospective figure of ~3,000.',
        diff: [],
      },
      {
        revisionNumber: 2,
        timestamp: '2026-07-12T00:00:00.000Z',
        agent: { id: 'seed-catalog-editorial', type: 'user', displayName: 'Editorial review' },
        changeType: 'correction',
        summary:
          'Corrected founding attendance from ~3,000 (single uncited secondary source) to ~1,200, based on the institution\u2019s own 1975 membership rolls.',
        diff: [
          { field: 'statement', before: 'approximately 3,000 members', after: 'approximately 1,200 members' },
          { field: 'confidence', before: 'single-source', after: 'contested' },
        ],
      },
    ],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
  },
  {
    id: asFactId('BB-F-000004'),
    slug: 'commemorative-plaque-quote-attribution',
    statement:
      'The commemorative plaque\u2019s inscribed quotation is attributed to a 1975 dedication speech; no earlier recorded instance of the exact wording has been found.',
    shortStatement: 'Plaque quote traced to 1975 dedication speech',
    claimType: 'quote-attribution',
    subjects: [{ entityId: 'ent_seed_institution_001', kind: 'institution', role: 'artifact-context' }],
    when: { validFrom: '1975', datePrecision: 'year' },
    qualifiers: [],
    counterClaims: [],
    relatedFacts: [{ factId: 'BB-F-000003', type: 'contextualizes' }],
    provenance: { researchedBy: 'seed-catalog', method: 'archival-record-review' },
    status: 'published',
    confidence: 'single-source',
    confidenceNote:
      'Only one archival recording of the 1975 dedication ceremony has been located; the attribution is documented but not yet independently corroborated by a second source.',
    citations: [
      {
        csl: {
          id: 'csl-dedication-recording',
          type: 'sound-recording',
          title: '1975 dedication ceremony audio recording',
        },
        sourceClass: 'primary',
        role: 'supports',
        excerpt: 'Recording timestamp 14:02 — the speaker delivers the quotation later inscribed on the plaque.',
        accessedAt: '2026-03-01T00:00:00.000Z',
        sourceNote: 'Held in the institution\u2019s own archive; no stable URL exists for this record.',
      },
    ],
    revisions: [
      {
        revisionNumber: 1,
        timestamp: '2026-07-14T00:00:00.000Z',
        agent: { id: 'seed-catalog', type: 'system', displayName: 'Seed catalog' },
        changeType: 'update',
        summary: 'Initial publication from the archival audio review.',
        diff: [],
      },
    ],
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
  },
  {
    id: asFactId('BB-F-000005'),
    slug: 'draft-unreviewed-population-estimate',
    statement: 'Draft: the neighborhood\u2019s 1930 population is estimated from an unverified secondary tabulation.',
    shortStatement: 'Draft: 1930 population estimate (unreviewed)',
    claimType: 'quantity',
    subjects: [{ entityId: 'ent_seed_place_001', kind: 'place', role: 'subject' }],
    when: { validFrom: '1930', datePrecision: 'year' },
    qualifiers: [],
    counterClaims: [],
    relatedFacts: [],
    provenance: { researchedBy: 'seed-catalog', method: 'secondary-tabulation-review' },
    status: 'draft',
    confidence: 'single-source',
    confidenceNote: 'Not yet reviewed; the single source has not been independently checked.',
    citations: [],
    revisions: [],
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  },
  ...NATIONAL_STORY_FACTS,
];

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
