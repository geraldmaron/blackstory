/**
 * Curated legal landscape seed catalog for web surfaces. Fixtures only — stands in for
 * Firestore `legalSnapshots` + published `FactRecord` projections. Fact ids `BB-F-000010`+
 * are scoped to this legal catalog (distinct from retired public quick-facts seed ranges).
 */
import {
  asFactId,
  type FactRecord,
  type LegalCatalogEntry,
  type LegalPlainLanguageExplainer,
  type LegalSnapshot,
} from '@repo/domain';

export const LEGAL_SEED_RELEASE_ID = 'legal-seed-2026-07-17';

const REVIEWED_AT = '2026-07-10';
const RETRIEVED_AT = '2026-07-17T00:00:00.000Z';

function archive(sourceUrl: string, changeHash?: string) {
  return {
    sourceUrl,
    officialUrl: sourceUrl,
    archivedCaptureUrl: `https://web.archive.org/web/20260717000000/${sourceUrl}`,
    retrievedAt: RETRIEVED_AT,
    ...(changeHash !== undefined ? { changeHash } : {}),
  };
}

function explainer(
  whatItSays: string,
  whatItMeans: readonly string[],
  whyItMatters: readonly string[],
  rightsToday: LegalPlainLanguageExplainer['rightsToday'],
  primarySources: LegalPlainLanguageExplainer['primarySources'],
  termOfArtLinks?: LegalPlainLanguageExplainer['termOfArtLinks'],
): LegalPlainLanguageExplainer {
  return {
    whatItSays,
    whatItMeans,
    whyItMatters,
    rightsToday,
    primarySources,
    reviewedAt: REVIEWED_AT,
    ...(termOfArtLinks !== undefined ? { termOfArtLinks } : {}),
  };
}

function lawFact(
  id: string,
  slug: string,
  statement: string,
  shortStatement: string,
  entityId: string,
  enactedYear: string,
): FactRecord {
  return {
    id: asFactId(id),
    slug,
    statement,
    shortStatement,
    claimType: 'law',
    subjects: [{ entityId, kind: 'law', role: 'primary-subject' }],
    when: { validFrom: enactedYear, datePrecision: 'year' },
    qualifiers: [],
    counterClaims: [],
    relatedFacts: [],
    // No CanonicalClaim backs these seed facts yet (they predate `derivedFromClaimIds` /
    // the related workstream and there is no unambiguous claim id to backfill against) — left empty
    // rather than guessed. See packages/domain/src/facts/derivation.ts's module doc: an empty
    // array is a no-op for the derivation-consistency check, not a failure.
    derivedFromClaimIds: [],
    derivedFromRelationshipIds: [],
    provenance: {
      researchedBy: 'legal-seed-catalog',
      reviewedBy: 'legal-seed-editorial',
      reviewedAt: `${REVIEWED_AT}T00:00:00.000Z`,
      method: 'primary-source-legal-review',
    },
    status: 'published',
    confidence: 'established',
    citations: [
      {
        csl: { id: `csl-${slug}`, type: 'legislation', title: shortStatement, URL: `https://example.gov/law/${slug}` },
        sourceClass: 'primary',
        role: 'supports',
        excerpt: statement.slice(0, 120),
        archivedUrl: `https://web.archive.org/web/20260717000000/https://example.gov/law/${slug}`,
        archivedAt: RETRIEVED_AT,
        accessedAt: RETRIEVED_AT,
      },
    ],
    revisions: [
      {
        revisionNumber: 1,
        timestamp: `${REVIEWED_AT}T00:00:00.000Z`,
        agent: { id: 'legal-seed-catalog', type: 'system', displayName: 'Legal seed catalog' },
        changeType: 'update',
        summary: 'Initial publication from curated legal snapshot seed.',
        diff: [],
      },
    ],
    createdAt: `${REVIEWED_AT}T00:00:00.000Z`,
    updatedAt: `${REVIEWED_AT}T00:00:00.000Z`,
  };
}

export const SEED_LEGAL_SNAPSHOTS: readonly LegalSnapshot[] = [
  {
    id: 'legal-cra-1964',
    slug: 'civil-rights-act-1964',
    kind: 'federal-statute',
    title: 'Civil Rights Act of 1964',
    jurisdictionId: 'us',
    lawStatus: 'amended',
    topics: ['employment', 'education', 'housing'],
    citation: {
      canonicalCitation: 'Pub. L. 88-352, 78 Stat. 241',
      licenseTag: 'public-domain',
      archive: archive('https://api.congress.gov/v3/law/88/pub/352', '1964-07-02:Signed'),
    },
    externalIds: [{ source: 'congress-gov-v3', externalId: '88/pub/352' }],
    factId: 'BB-F-000010',
  },
  {
    id: 'legal-vra-1965',
    slug: 'voting-rights-act-1965',
    kind: 'federal-statute',
    title: 'Voting Rights Act of 1965',
    jurisdictionId: 'us',
    lawStatus: 'amended',
    topics: ['voting', 'constitutional'],
    citation: {
      canonicalCitation: 'Pub. L. 89-110, 79 Stat. 437',
      licenseTag: 'public-domain',
      archive: archive('https://api.congress.gov/v3/law/89/pub/110', '1965-08-06:Signed'),
    },
    externalIds: [{ source: 'congress-gov-v3', externalId: '89/pub/110' }],
    factId: 'BB-F-000011',
  },
  {
    id: 'legal-fha-1968',
    slug: 'fair-housing-act-1968',
    kind: 'federal-statute',
    title: 'Fair Housing Act of 1968',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['housing'],
    citation: {
      canonicalCitation: 'Pub. L. 90-284, Title VIII',
      licenseTag: 'public-domain',
      archive: archive('https://www.hud.gov/program_offices/fair_housing_equal_opp/fair_housing_act_overview'),
    },
    externalIds: [{ source: 'congress-gov-v3', externalId: '90/pub/284' }],
    factId: 'BB-F-000012',
  },
  {
    id: 'legal-1983',
    slug: '42-usc-1983',
    kind: 'federal-statute',
    title: '42 U.S.C. § 1983 — Civil action for deprivation of rights',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['policing', 'employment'],
    citation: {
      canonicalCitation: '42 U.S.C. § 1983',
      licenseTag: 'public-domain',
      archive: archive('https://www.ecfr.gov/current/title-42/chapter-21/subchapter-I/part-1983', '2026-01-01'),
    },
    externalIds: [{ source: 'ecfr-versioner', externalId: 'title-42/part-1983' }],
    factId: 'BB-F-000013',
  },
  {
    id: 'legal-brown-1954',
    slug: 'brown-v-board-of-education',
    kind: 'landmark-case',
    title: 'Brown v. Board of Education',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['education', 'constitutional'],
    citation: {
      canonicalCitation: '347 U.S. 483 (1954)',
      licenseTag: 'public-domain',
      archive: archive('https://www.courtlistener.com/opinion/108713/brown-v-board-of-education/', '1954-05-17:347 U.S. 483'),
    },
    externalIds: [{ source: 'courtlistener-bulk', externalId: '108713' }],
    factId: 'BB-F-000014',
  },
  {
    id: 'legal-shelby-2013',
    slug: 'shelby-county-v-holder',
    kind: 'landmark-case',
    title: 'Shelby County v. Holder',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['voting', 'constitutional'],
    citation: {
      canonicalCitation: '570 U.S. 529 (2013)',
      licenseTag: 'public-domain',
      archive: archive('https://www.courtlistener.com/opinion/813086/shelby-county-v-holder/', '2013-06-25:570 U.S. 529'),
    },
    externalIds: [{ source: 'courtlistener-bulk', externalId: '813086' }],
    factId: 'BB-F-000015',
  },
  {
    id: 'legal-13th-amendment',
    slug: 'thirteenth-amendment',
    kind: 'federal-statute',
    title: 'Thirteenth Amendment',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['constitutional', 'criminal-justice'],
    citation: {
      canonicalCitation: 'U.S. Const. amend. XIII',
      licenseTag: 'public-domain',
      archive: archive('https://www.archives.gov/milestone-documents/13th-amendment'),
    },
    externalIds: [{ source: 'congress-gov-v3', externalId: 'const/amend-xiii' }],
    factId: 'BB-F-000016',
  },
  {
    id: 'legal-14th-amendment',
    slug: 'fourteenth-amendment',
    kind: 'federal-statute',
    title: 'Fourteenth Amendment',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['constitutional', 'policing'],
    citation: {
      canonicalCitation: 'U.S. Const. amend. XIV',
      licenseTag: 'public-domain',
      archive: archive('https://www.archives.gov/milestone-documents/14th-amendment'),
    },
    externalIds: [{ source: 'congress-gov-v3', externalId: 'const/amend-xiv' }],
    factId: 'BB-F-000017',
  },
  {
    id: 'legal-15th-amendment',
    slug: 'fifteenth-amendment',
    kind: 'federal-statute',
    title: 'Fifteenth Amendment',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['voting', 'constitutional'],
    citation: {
      canonicalCitation: 'U.S. Const. amend. XV',
      licenseTag: 'public-domain',
      archive: archive('https://www.archives.gov/milestone-documents/15th-amendment'),
    },
    externalIds: [{ source: 'congress-gov-v3', externalId: 'const/amend-xv' }],
    factId: 'BB-F-000018',
  },
  {
    id: 'legal-title-vii-regs',
    slug: 'title-vii-cfr-part-1604',
    kind: 'federal-regulation',
    title: 'EEOC Title VII Regulations — Sex Discrimination',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['employment'],
    citation: {
      canonicalCitation: '29 CFR Part 1604',
      licenseTag: 'public-domain',
      archive: archive('https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1604', '2026-01-01'),
    },
    externalIds: [{ source: 'ecfr-versioner', externalId: 'title-29/part-1604' }],
    factId: 'BB-F-000019',
  },
  {
    id: 'legal-ga-sb202',
    slug: 'georgia-sb202-2021',
    kind: 'state-statute',
    title: 'Georgia Election Integrity Act of 2021 (SB 202)',
    jurisdictionId: 'us-13',
    lawStatus: 'in_force',
    topics: ['voting'],
    citation: {
      canonicalCitation: 'Ga. Code Ann. § 21-2 (2021 SB 202)',
      licenseTag: 'link-only',
      archive: archive('https://www.legis.ga.gov/legislation/59827', 'abc123seed'),
    },
    externalIds: [{ source: 'legiscan-free', externalId: '1900123' }],
    factId: 'BB-F-000020',
  },
  {
    id: 'legal-sffa-2023',
    slug: 'students-for-fair-admissions-v-harvard',
    kind: 'landmark-case',
    title: 'Students for Fair Admissions v. Harvard',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['education', 'constitutional'],
    citation: {
      canonicalCitation: '600 U.S. 181 (2023)',
      licenseTag: 'public-domain',
      archive: archive('https://www.supremecourt.gov/opinions/22pdf/20-1199_hgdj.pdf', '2023-06-29:600 U.S. 181'),
    },
    externalIds: [{ source: 'courtlistener-bulk', externalId: '9383451' }],
    factId: 'BB-F-000021',
  },
];

export const SEED_LEGAL_CATALOG: readonly LegalCatalogEntry[] = [
  {
    snapshotId: 'legal-cra-1964',
    explainer: explainer(
      'The Civil Rights Act of 1964 (Pub. L. 88-352) bans discrimination based on race, color, religion, sex, or national origin in public accommodations and employment.',
      [
        'Title II opened hotels, restaurants, and theaters to all customers regardless of race.',
        'Title VII created the Equal Employment Opportunity Commission to investigate workplace discrimination.',
        'Title VI tied federal funding to non-discrimination — schools and agencies could lose money if they discriminated.',
      ],
      [
        'Before 1964, "Whites Only" signs were legal in much of the South. Black travelers could be turned away from motels and diners.',
        'The Act gave federal courts a direct tool to strike down segregation laws that states had kept for decades.',
      ],
      [
        { label: 'File an employment discrimination charge (EEOC)', agencyUrl: 'https://www.eeoc.gov/filing-charge-discrimination' },
        { label: 'Report housing discrimination (HUD)', agencyUrl: 'https://www.hud.gov/program_offices/fair_housing_equal_opp/online-complaint' },
      ],
      [
        { label: 'Congress.gov — Pub. L. 88-352', url: 'https://api.congress.gov/v3/law/88/pub/352', licenseTag: 'public-domain' },
      ],
      [{ term: 'public accommodation', wexUrl: 'https://www.law.cornell.edu/wex/public_accommodation' }],
    ),
  },
  {
    snapshotId: 'legal-vra-1965',
    explainer: explainer(
      'The Voting Rights Act of 1965 (Pub. L. 89-110) outlawed literacy tests and required federal oversight of election changes in places with a history of voting discrimination.',
      [
        'Section 2 bans any voting practice that denies or limits the right to vote based on race.',
        'Section 5 (preclearance) required covered jurisdictions to get federal approval before changing election rules — until Shelby County v. Holder (2013).',
        'Section 203 requires bilingual election materials in areas with large language-minority populations.',
      ],
      [
        'Literacy tests were used for decades to block Black voters who had been denied equal education.',
        'The Act is widely credited with dramatically increasing Black voter registration in the Deep South.',
      ],
      [
        { label: 'Report a voting rights violation (DOJ Civil Rights Division)', agencyUrl: 'https://civilrights.justice.gov/' },
        { label: 'Find your election office (USA.gov)', agencyUrl: 'https://www.usa.gov/election-office' },
      ],
      [{ label: 'Congress.gov — Pub. L. 89-110', url: 'https://api.congress.gov/v3/law/89/pub/110', licenseTag: 'public-domain' }],
      [{ term: 'preclearance', wexUrl: 'https://www.law.cornell.edu/wex/preclearance' }],
    ),
  },
  {
    snapshotId: 'legal-brown-1954',
    explainer: explainer(
      'Brown v. Board of Education, 347 U.S. 483 (1954), held that racial segregation in public schools violates the Equal Protection Clause of the Fourteenth Amendment.',
      [
        'The Court overturned Plessy v. Ferguson\'s "separate but equal" rule for public schools.',
        'Chief Justice Warren wrote for a unanimous Court that separate schools are "inherently unequal."',
        'The decision did not set a deadline for desegregation — Brown II (1955) called for it "with all deliberate speed."',
      ],
      [
        'School segregation was the legal backbone of Jim Crow. Brown opened the door to the modern civil-rights movement.',
        'Many districts resisted for years; federal troops were sent to Little Rock Central High School in 1957.',
      ],
      [
        { label: 'File an education civil-rights complaint (DOJ)', agencyUrl: 'https://civilrights.justice.gov/' },
        { label: 'File a school discrimination complaint (OCR)', agencyUrl: 'https://www2.ed.gov/about/offices/list/ocr/complaintintro.html' },
      ],
      [
        { label: 'CourtListener — Brown v. Board', url: 'https://www.courtlistener.com/opinion/108713/brown-v-board-of-education/', licenseTag: 'public-domain' },
        { label: 'Oyez case summary (link + attributed quote only)', url: 'https://www.oyez.org/cases/1940-1955/347us483', licenseTag: 'link-only' },
      ],
      [{ term: 'Equal Protection Clause', wexUrl: 'https://www.law.cornell.edu/wex/equal_protection' }],
    ),
  },
  {
    snapshotId: 'legal-shelby-2013',
    explainer: explainer(
      'Shelby County v. Holder, 570 U.S. 529 (2013), struck down the Voting Rights Act\'s coverage formula that determined which states needed federal preclearance for election changes.',
      [
        'The Court said the 1965 coverage formula was outdated and violated state sovereignty.',
        'Section 2 still bans discriminatory voting practices nationwide, but preclearance no longer applies automatically.',
        'Congress has not passed a new coverage formula since the decision.',
      ],
      [
        'States that had been under preclearance quickly passed new voting laws after Shelby County.',
        'Civil-rights groups argue the decision removed a key guardrail against voter suppression.',
      ],
      [
        { label: 'Report a voting rights violation (DOJ)', agencyUrl: 'https://civilrights.justice.gov/' },
      ],
      [{ label: 'CourtListener — Shelby County', url: 'https://www.courtlistener.com/opinion/813086/shelby-county-v-holder/', licenseTag: 'public-domain' }],
    ),
  },
  {
    snapshotId: 'legal-1983',
    explainer: explainer(
      '42 U.S.C. § 1983 lets people sue state and local officials who violate their federal constitutional or statutory rights while acting under "color of law."',
      [
        'You can seek money damages and court orders against officials who violate your rights.',
        'The official must be acting in their government role — not as a private citizen.',
        'Qualified immunity may limit suits against individual officers in some circumstances.',
      ],
      [
        'Section 1983 is the main federal tool for holding police and government officials accountable for civil-rights violations.',
        'It was originally part of the Ku Klux Klan Act of 1871 to protect freedmen from state violence.',
      ],
      [
        { label: 'Report police misconduct (DOJ)', agencyUrl: 'https://civilrights.justice.gov/' },
        { label: 'Find a legal aid office (LSC)', agencyUrl: 'https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help' },
      ],
      [{ label: 'eCFR — 42 U.S.C. § 1983', url: 'https://www.ecfr.gov/current/title-42/chapter-21/subchapter-I/part-1983', licenseTag: 'public-domain' }],
      [{ term: 'color of law', wexUrl: 'https://www.law.cornell.edu/wex/color_of_law' }],
    ),
  },
];

export const SEED_LEGAL_FACTS: readonly FactRecord[] = [
  lawFact(
    'BB-F-000010',
    'civil-rights-act-1964-enacted',
    'The Civil Rights Act of 1964 was enacted on July 2, 1964, banning discrimination based on race, color, religion, sex, or national origin in public accommodations and employment.',
    'Civil Rights Act of 1964 enacted',
    'ent_seed_law_cra_1964',
    '1964',
  ),
  lawFact(
    'BB-F-000011',
    'voting-rights-act-1965-enacted',
    'The Voting Rights Act of 1965 was enacted on August 6, 1965, outlawing literacy tests and requiring federal oversight of election changes in covered jurisdictions.',
    'Voting Rights Act of 1965 enacted',
    'ent_seed_law_vra_1965',
    '1965',
  ),
  lawFact(
    'BB-F-000012',
    'fair-housing-act-1968-enacted',
    'The Fair Housing Act of 1968 was enacted on April 11, 1968, prohibiting discrimination in the sale, rental, and financing of housing based on race, religion, national origin, and sex.',
    'Fair Housing Act of 1968 enacted',
    'ent_seed_law_fha_1968',
    '1968',
  ),
  lawFact(
    'BB-F-000013',
    'section-1983-civil-rights-statute',
    '42 U.S.C. § 1983 provides a federal cause of action against state and local officials who violate constitutional or statutory rights under color of law.',
    '42 U.S.C. § 1983 — civil rights statute',
    'ent_seed_law_1983',
    '1871',
  ),
  lawFact(
    'BB-F-000014',
    'brown-v-board-1954-holding',
    'In Brown v. Board of Education (1954), the Supreme Court held that racial segregation in public schools violates the Equal Protection Clause of the Fourteenth Amendment.',
    'Brown v. Board — school segregation unconstitutional',
    'ent_seed_law_brown_1954',
    '1954',
  ),
  lawFact(
    'BB-F-000015',
    'shelby-county-2013-preclearance',
    'In Shelby County v. Holder (2013), the Supreme Court struck down the Voting Rights Act coverage formula that determined which jurisdictions required federal preclearance.',
    'Shelby County — VRA preclearance formula struck',
    'ent_seed_law_shelby_2013',
    '2013',
  ),
  lawFact(
    'BB-F-000016',
    'thirteenth-amendment-abolition',
    'The Thirteenth Amendment abolished slavery and involuntary servitude except as punishment for a crime after conviction.',
    '13th Amendment abolished slavery',
    'ent_seed_law_13th',
    '1865',
  ),
  lawFact(
    'BB-F-000017',
    'fourteenth-amendment-equal-protection',
    'The Fourteenth Amendment guarantees equal protection of the laws and due process to all persons within a state\'s jurisdiction.',
    '14th Amendment — equal protection',
    'ent_seed_law_14th',
    '1868',
  ),
  lawFact(
    'BB-F-000018',
    'fifteenth-amendment-voting-rights',
    'The Fifteenth Amendment prohibits denying the right to vote based on race, color, or previous condition of servitude.',
    '15th Amendment — voting rights by race',
    'ent_seed_law_15th',
    '1870',
  ),
  lawFact(
    'BB-F-000019',
    'title-vii-eeoc-regulations',
    '29 CFR Part 1604 implements Title VII of the Civil Rights Act, defining unlawful employment practices related to sex discrimination.',
    'Title VII EEOC regulations (29 CFR 1604)',
    'ent_seed_law_title_vii_regs',
    '1964',
  ),
  lawFact(
    'BB-F-000020',
    'georgia-sb202-2021-enacted',
    'Georgia SB 202 (2021) changed state election procedures including absentee ballot rules, drop box access, and early voting hours.',
    'Georgia SB 202 election law (2021)',
    'ent_seed_law_ga_sb202',
    '2021',
  ),
  lawFact(
    'BB-F-000021',
    'sffa-v-harvard-2023-holding',
    'In Students for Fair Admissions v. Harvard (2023), the Supreme Court held that race-based affirmative action in college admissions violates the Equal Protection Clause.',
    'SFFA v. Harvard — race-conscious admissions barred',
    'ent_seed_law_sffa_2023',
    '2023',
  ),
];

export function getLegalSnapshot(id: string): LegalSnapshot | undefined {
  return SEED_LEGAL_SNAPSHOTS.find((snapshot) => snapshot.id === id);
}

export function getLegalSnapshotBySlug(slug: string): LegalSnapshot | undefined {
  return SEED_LEGAL_SNAPSHOTS.find((snapshot) => snapshot.slug === slug);
}

export function listLegalSnapshots(): readonly LegalSnapshot[] {
  return SEED_LEGAL_SNAPSHOTS;
}

export function getLegalCatalogEntry(snapshotId: string): LegalCatalogEntry | undefined {
  return SEED_LEGAL_CATALOG.find((entry) => entry.snapshotId === snapshotId);
}

export function getLegalFact(id: string): FactRecord | undefined {
  return SEED_LEGAL_FACTS.find((fact) => fact.id === id);
}

export function listLegalFacts(): readonly FactRecord[] {
  return SEED_LEGAL_FACTS;
}
