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

export const LEGAL_SEED_RELEASE_ID = 'legal-seed-2026-08-03';

const REVIEWED_AT = '2026-08-03';
const RETRIEVED_AT = '2026-08-03T00:00:00.000Z';
const CAPTURE_STAMP = '20260803000000';

function archive(sourceUrl: string, changeHash?: string) {
  return {
    sourceUrl,
    officialUrl: sourceUrl,
    archivedCaptureUrl: `https://web.archive.org/web/${CAPTURE_STAMP}/${sourceUrl}`,
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
  /** Primary-source URL the citation resolves to. Verified by hand at `REVIEWED_AT`. */
  sourceUrl: string,
  /** CSL `type` — `legislation` for statutes and regulations, `legal_case` for decisions. */
  cslType: 'legislation' | 'legal_case' = 'legislation',
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
        csl: {
          id: `csl-${slug}`,
          type: cslType,
          title: shortStatement,
          URL: sourceUrl,
        },
        sourceClass: 'primary',
        role: 'supports',
        excerpt: statement.slice(0, 120),
        archivedUrl: `https://web.archive.org/web/${CAPTURE_STAMP}/${sourceUrl}`,
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
      canonicalCitation: 'Pub. L. 88-352, 78 Stat. 241 (July 2, 1964)',
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
      canonicalCitation: 'Pub. L. 89-110, 79 Stat. 437 (Aug. 6, 1965)',
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
    // 'amended', not 'in_force': the 1974 and 1988 amendments added protected classes the
    // 1968 text did not carry (sex; handicap and familial status).
    lawStatus: 'amended',
    topics: ['housing'],
    citation: {
      canonicalCitation:
        'Pub. L. 90-284, tit. VIII, § 801, 82 Stat. 81 (Apr. 11, 1968) (codified as amended at 42 U.S.C. §§ 3601-3631)',
      licenseTag: 'public-domain',
      archive: archive(
        'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section3604&num=0&edition=prelim',
        '1988-09-13:Pub. L. 100-430',
      ),
    },
    externalIds: [
      { source: 'congress-gov-v3', externalId: '90/pub/284' },
      { source: 'us-code-olrc', externalId: 'title42/section3604' },
    ],
    factId: 'BB-F-000012',
  },
  {
    id: 'legal-1983',
    slug: '42-usc-1983',
    kind: 'federal-statute',
    title: '42 U.S.C. § 1983 — Civil action for deprivation of rights',
    jurisdictionId: 'us',
    lawStatus: 'amended',
    topics: ['policing', 'employment'],
    citation: {
      canonicalCitation:
        '42 U.S.C. § 1983 (R.S. § 1979; act of Apr. 20, 1871, ch. 22, § 1, 17 Stat. 13)',
      licenseTag: 'public-domain',
      // Was pointed at eCFR, which publishes regulations only and has no title-42 part 1983.
      // Section 1983 is statute; the OLRC U.S. Code is its authoritative online text.
      archive: archive(
        'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1983&num=0&edition=prelim',
        '1996-10-19:Pub. L. 104-317',
      ),
    },
    externalIds: [{ source: 'us-code-olrc', externalId: 'title42/section1983' }],
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
      archive: archive(
        'https://tile.loc.gov/storage-services/service/ll/usrep/usrep347/usrep347483/usrep347483.pdf',
        '1954-05-17:347 U.S. 483',
      ),
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
      archive: archive(
        'https://tile.loc.gov/storage-services/service/ll/usrep/usrep570/usrep570529/usrep570529.pdf',
        '2013-06-25:570 U.S. 529',
      ),
    },
    externalIds: [{ source: 'courtlistener-bulk', externalId: '813086' }],
    factId: 'BB-F-000015',
  },
  {
    id: 'legal-13th-amendment',
    slug: 'thirteenth-amendment',
    kind: 'constitutional-amendment',
    title: 'Thirteenth Amendment',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['constitutional', 'criminal-justice'],
    citation: {
      canonicalCitation: 'U.S. Const. amend. XIII (proposed Jan. 31, 1865; ratified Dec. 6, 1865)',
      licenseTag: 'public-domain',
      archive: archive('https://www.archives.gov/milestone-documents/13th-amendment'),
    },
    externalIds: [{ source: 'congress-gov-v3', externalId: 'const/amend-xiii' }],
    factId: 'BB-F-000016',
  },
  {
    id: 'legal-14th-amendment',
    slug: 'fourteenth-amendment',
    kind: 'constitutional-amendment',
    title: 'Fourteenth Amendment',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['constitutional', 'policing'],
    citation: {
      canonicalCitation: 'U.S. Const. amend. XIV (passed June 13, 1866; ratified July 9, 1868)',
      licenseTag: 'public-domain',
      archive: archive('https://www.archives.gov/milestone-documents/14th-amendment'),
    },
    externalIds: [{ source: 'congress-gov-v3', externalId: 'const/amend-xiv' }],
    factId: 'BB-F-000017',
  },
  {
    id: 'legal-15th-amendment',
    slug: 'fifteenth-amendment',
    kind: 'constitutional-amendment',
    title: 'Fifteenth Amendment',
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['voting', 'constitutional'],
    citation: {
      canonicalCitation: 'U.S. Const. amend. XV (passed Feb. 26, 1869; ratified Feb. 3, 1870)',
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
    title: 'EEOC Guidelines on Discrimination Because of Sex (29 CFR Part 1604)',
    jurisdictionId: 'us',
    // 'amended': § 1604.11(c) was rescinded after Ellerth and Faragher (1998) and is
    // carried in the current CFR as [Reserved].
    lawStatus: 'amended',
    topics: ['employment'],
    citation: {
      canonicalCitation:
        '29 C.F.R. pt. 1604 (source: 37 Fed. Reg. 6836, Apr. 5, 1972; authority: 42 U.S.C. § 2000e-12)',
      licenseTag: 'public-domain',
      archive: archive(
        'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1604',
        '2026-01-01',
      ),
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
      canonicalCitation:
        'Election Integrity Act of 2021, S.B. 202, 2021-2022 Reg. Sess. (Ga. 2021) (codified as amended in O.C.G.A. tit. 21, ch. 2), effective Mar. 25, 2021',
      licenseTag: 'link-only',
      // Was a placeholder hash against the bill landing page, which renders client-side and
      // carries no bill text. Points at the as-passed engrossment PDF instead.
      archive: archive(
        'https://www.legis.ga.gov/api/legislation/document/20212022/201498',
        '2021-03-25:SB 202/AP',
      ),
    },
    externalIds: [{ source: 'legis-ga-gov', externalId: '20212022/201498' }],
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
      canonicalCitation:
        '600 U.S. 181 (2023) (No. 20-1199, decided June 29, 2023, with No. 21-707, SFFA v. University of North Carolina)',
      licenseTag: 'public-domain',
      archive: archive(
        'https://www.supremecourt.gov/opinions/22pdf/20-1199_hgdj.pdf',
        '2023-06-29:600 U.S. 181',
      ),
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
        {
          label: 'File an employment discrimination charge (EEOC)',
          agencyUrl: 'https://www.eeoc.gov/filing-charge-discrimination',
        },
        {
          label: 'Report housing discrimination (HUD)',
          agencyUrl: 'https://www.hud.gov/program_offices/fair_housing_equal_opp/online-complaint',
        },
      ],
      [
        {
          label: 'Congress.gov — Pub. L. 88-352',
          url: 'https://api.congress.gov/v3/law/88/pub/352',
          licenseTag: 'public-domain',
        },
        {
          label: 'Statutes at Large — 78 Stat. 241 (GovInfo)',
          url: 'https://www.govinfo.gov/content/pkg/STATUTE-78/pdf/STATUTE-78-Pg241.pdf',
          licenseTag: 'public-domain',
        },
      ],
      [
        {
          term: 'public accommodation',
          wexUrl: 'https://www.law.cornell.edu/wex/public_accommodation',
        },
      ],
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
        'The statute opens by declaring its purpose: "To enforce the fifteenth amendment to the Constitution of the United States." Congress passed it 95 years after that Amendment was ratified.',
        "Section 2 remains the operative tool. In Allen v. Milligan, 599 U.S. 1 (2023), the Court affirmed a ruling that Alabama's congressional map likely violated Section 2, leaving the long-standing Thornburg v. Gingles framework in place.",
      ],
      [
        {
          label: 'Report a voting rights violation (DOJ Civil Rights Division)',
          agencyUrl: 'https://civilrights.justice.gov/',
        },
        {
          label: 'Find your election office (USA.gov)',
          agencyUrl: 'https://www.usa.gov/election-office',
        },
      ],
      [
        {
          label: 'Congress.gov — Pub. L. 89-110',
          url: 'https://api.congress.gov/v3/law/89/pub/110',
          licenseTag: 'public-domain',
        },
        {
          label: 'Statutes at Large — 79 Stat. 437 (GovInfo)',
          url: 'https://www.govinfo.gov/content/pkg/STATUTE-79/pdf/STATUTE-79-Pg437.pdf',
          licenseTag: 'public-domain',
        },
      ],
      [{ term: 'preclearance', wexUrl: 'https://www.law.cornell.edu/wex/preclearance' }],
    ),
  },
  {
    snapshotId: 'legal-brown-1954',
    explainer: explainer(
      'Brown v. Board of Education, 347 U.S. 483 (1954), held that racial segregation in public schools violates the Equal Protection Clause of the Fourteenth Amendment.',
      [
        'The Court overturned Plessy v. Ferguson\'s "separate but equal" rule for public schools.',
        'Chief Justice Warren wrote for a unanimous Court: "Separate educational facilities are inherently unequal." 347 U.S. at 495.',
        'The decision did not set a deadline for desegregation — Brown II (1955) called for it "with all deliberate speed."',
      ],
      [
        'School segregation was the legal backbone of Jim Crow. Brown opened the door to the modern civil-rights movement.',
        'Many districts resisted for years; federal troops were sent to Little Rock Central High School in 1957.',
      ],
      [
        {
          label: 'File an education civil-rights complaint (DOJ)',
          agencyUrl: 'https://civilrights.justice.gov/',
        },
        {
          label: 'File a school discrimination complaint (OCR)',
          agencyUrl: 'https://www2.ed.gov/about/offices/list/ocr/complaintintro.html',
        },
      ],
      [
        {
          label: 'U.S. Reports, 347 U.S. 483 (Library of Congress scan)',
          url: 'https://tile.loc.gov/storage-services/service/ll/usrep/usrep347/usrep347483/usrep347483.pdf',
          licenseTag: 'public-domain',
        },
        {
          label: 'CourtListener — Brown v. Board',
          url: 'https://www.courtlistener.com/opinion/108713/brown-v-board-of-education/',
          licenseTag: 'public-domain',
        },
        {
          label: 'Oyez case summary (link + attributed quote only)',
          url: 'https://www.oyez.org/cases/1940-1955/347us483',
          licenseTag: 'link-only',
        },
      ],
      [
        {
          term: 'Equal Protection Clause',
          wexUrl: 'https://www.law.cornell.edu/wex/equal_protection',
        },
      ],
    ),
  },
  {
    snapshotId: 'legal-shelby-2013',
    explainer: explainer(
      "Shelby County v. Holder, 570 U.S. 529 (2013), struck down the Voting Rights Act's coverage formula that determined which states needed federal preclearance for election changes.",
      [
        'The Court held only Section 4(b), the coverage formula, unconstitutional. It wrote that it "issue[d] no holding on §5 itself" — but with no formula, no jurisdiction is covered, so preclearance stopped operating.',
        'The Court said the formula rested on 40-year-old voting-test data rather than "current conditions."',
        'Section 2 still bans discriminatory voting practices nationwide, and voters must sue after the fact rather than have changes reviewed in advance.',
        'Congress has not enacted a new coverage formula since the decision.',
      ],
      [
        'States that had been under preclearance quickly passed new voting laws after Shelby County.',
        'Civil-rights groups argue the decision removed a key guardrail against voter suppression.',
      ],
      [
        {
          label: 'Report a voting rights violation (DOJ)',
          agencyUrl: 'https://civilrights.justice.gov/',
        },
      ],
      [
        {
          label: 'U.S. Reports, 570 U.S. 529 (Library of Congress scan)',
          url: 'https://tile.loc.gov/storage-services/service/ll/usrep/usrep570/usrep570529/usrep570529.pdf',
          licenseTag: 'public-domain',
        },
        {
          label: 'CourtListener — Shelby County',
          url: 'https://www.courtlistener.com/opinion/813086/shelby-county-v-holder/',
          licenseTag: 'public-domain',
        },
      ],
      [{ term: 'preclearance', wexUrl: 'https://www.law.cornell.edu/wex/preclearance' }],
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
        'It began as section 1 of the Ku Klux Klan Act — the act of April 20, 1871, ch. 22, 17 Stat. 13 — passed to protect freedpeople when Southern states would not.',
        'Congress amended it twice: in 1979 to cover the District of Columbia, and in 1996 to restrict injunctions against judicial officers.',
      ],
      [
        { label: 'Report police misconduct (DOJ)', agencyUrl: 'https://civilrights.justice.gov/' },
        {
          label: 'Find a legal aid office (LSC)',
          agencyUrl: 'https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help',
        },
      ],
      [
        {
          label: 'U.S. Code (OLRC) — 42 U.S.C. § 1983',
          url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1983&num=0&edition=prelim',
          licenseTag: 'public-domain',
        },
      ],
      [
        { term: 'color of law', wexUrl: 'https://www.law.cornell.edu/wex/color_of_law' },
        {
          term: 'qualified immunity',
          wexUrl: 'https://www.law.cornell.edu/wex/qualified_immunity',
        },
      ],
    ),
  },
  {
    snapshotId: 'legal-fha-1968',
    explainer: explainer(
      "The Fair Housing Act — Title VIII of Pub. L. 90-284, 82 Stat. 81, signed April 11, 1968 — makes it unlawful to refuse to sell or rent a dwelling, or to set different terms for one, because of a person's race, color, religion, sex, familial status, or national origin (42 U.S.C. § 3604).",
      [
        'It reaches more than an outright "no." Section 3604 also bans steering, discriminatory advertising, and telling someone a unit is unavailable when it is not.',
        'It covers the money side too. The Act prohibits discrimination in mortgage lending and in the terms of housing-related loans.',
        'The 1968 text listed race, color, religion, and national origin. Congress added sex in 1974 and added disability and familial status in the Fair Housing Amendments Act of 1988 (Pub. L. 100-430), which also built the modern HUD enforcement process.',
        'Enforcement runs two ways: an administrative complaint to HUD, or a private lawsuit in federal court.',
      ],
      [
        'Congress passed it one week after Dr. King was assassinated, closing the last major gap the 1964 and 1965 Acts had left open — where people could live.',
        'The practices it targets had been federal policy. HOLC and FHA underwriting had graded Black neighborhoods as hazardous for decades, and racially restrictive covenants were written into deeds nationwide.',
        'Two months later the Supreme Court decided Jones v. Alfred H. Mayer Co., 392 U.S. 409 (1968), holding that 42 U.S.C. § 1982 — a surviving piece of the Civil Rights Act of 1866 — already barred all racial discrimination in the sale or rental of property, including by private sellers.',
      ],
      [
        {
          label: 'File a housing discrimination complaint (HUD)',
          agencyUrl: 'https://www.hud.gov/program_offices/fair_housing_equal_opp/online-complaint',
          note: 'HUD generally requires the complaint within one year of the incident.',
        },
        {
          label: 'Report a pattern of housing discrimination (DOJ Civil Rights Division)',
          agencyUrl: 'https://civilrights.justice.gov/',
        },
        {
          label: 'Find a legal aid office (LSC)',
          agencyUrl: 'https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help',
        },
      ],
      [
        {
          label: 'U.S. Code (OLRC) — 42 U.S.C. § 3604',
          url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section3604&num=0&edition=prelim',
          licenseTag: 'public-domain',
        },
        {
          label: 'U.S. Code (OLRC) — 42 U.S.C. § 3601 (declaration of policy, amendment history)',
          url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section3601&num=0&edition=prelim',
          licenseTag: 'public-domain',
        },
        {
          label: 'U.S. Reports, 392 U.S. 409 — Jones v. Alfred H. Mayer Co.',
          url: 'https://tile.loc.gov/storage-services/service/ll/usrep/usrep392/usrep392409/usrep392409.pdf',
          licenseTag: 'public-domain',
        },
      ],
      [
        { term: 'redlining', wexUrl: 'https://www.law.cornell.edu/wex/redlining' },
        {
          term: 'restrictive covenant',
          wexUrl: 'https://www.law.cornell.edu/wex/restrictive_covenant',
        },
      ],
    ),
  },
  {
    snapshotId: 'legal-13th-amendment',
    explainer: explainer(
      'The Thirteenth Amendment, ratified December 6, 1865, provides that "Neither slavery nor involuntary servitude, except as a punishment for crime whereof the party shall have been duly convicted, shall exist within the United States, or any place subject to their jurisdiction."',
      [
        'It abolished slavery everywhere in the country at once, and it binds private individuals — not only governments.',
        'It carries an exception. Forced labor remains constitutional as punishment after a criminal conviction, and that clause is still in the text today.',
        'Section 2 gives Congress power to enforce the Amendment "by appropriate legislation." That power is the constitutional footing for several civil-rights statutes.',
      ],
      [
        'Emancipation before 1865 rested on the Emancipation Proclamation, a war measure that reached only areas in rebellion. The Amendment made abolition permanent and national.',
        'Southern states answered the punishment clause with Black Codes and convict leasing, arresting Black men on vagrancy charges and leasing their labor to private companies. The exception written into the Amendment is what made that lawful.',
        'In Jones v. Alfred H. Mayer Co., 392 U.S. 409 (1968), the Court read Section 2 broadly, sustaining a Reconstruction-era property statute against private racial discrimination in housing.',
      ],
      [
        {
          label: 'Report human trafficking or forced labor (DOJ)',
          agencyUrl: 'https://www.justice.gov/humantrafficking/report-trafficking',
        },
        {
          label: 'Report a federal civil-rights violation (DOJ Civil Rights Division)',
          agencyUrl: 'https://civilrights.justice.gov/',
        },
      ],
      [
        {
          label: 'National Archives — 13th Amendment (Milestone Documents)',
          url: 'https://www.archives.gov/milestone-documents/13th-amendment',
          licenseTag: 'public-domain',
        },
        {
          label: 'U.S. Reports, 392 U.S. 409 — Jones v. Alfred H. Mayer Co.',
          url: 'https://tile.loc.gov/storage-services/service/ll/usrep/usrep392/usrep392409/usrep392409.pdf',
          licenseTag: 'public-domain',
        },
      ],
      [
        {
          term: 'involuntary servitude',
          wexUrl: 'https://www.law.cornell.edu/wex/involuntary_servitude',
        },
      ],
    ),
  },
  {
    snapshotId: 'legal-14th-amendment',
    explainer: explainer(
      'The Fourteenth Amendment, ratified July 9, 1868, makes everyone born or naturalized in the United States a citizen and forbids any State to "deprive any person of life, liberty, or property, without due process of law" or to "deny to any person within its jurisdiction the equal protection of the laws."',
      [
        'Its Citizenship Clause overruled Dred Scott, which had held that Black Americans could not be citizens.',
        'Equal protection restricts what States may do, so most challenges to discriminatory state and local laws are brought under this Amendment.',
        'Through the Due Process Clause, courts have applied most of the Bill of Rights against the States — a doctrine called incorporation.',
        'Section 5 lets Congress enforce the Amendment by legislation, which is the basis for much of modern federal civil-rights law.',
      ],
      [
        'For nearly a century the Court did not enforce its promise. Plessy v. Ferguson, 163 U.S. 537 (1896), allowed "separate but equal," and state-mandated segregation followed.',
        'Brown v. Board of Education, 347 U.S. 483 (1954), rejected that rule for public schools under the Equal Protection Clause.',
        'The Clause still decides the hardest current cases. Students for Fair Admissions v. Harvard, 600 U.S. 181 (2023), held race-conscious college admissions unconstitutional under the same provision that ended school segregation.',
      ],
      [
        {
          label: 'Report a federal civil-rights violation (DOJ Civil Rights Division)',
          agencyUrl: 'https://civilrights.justice.gov/',
        },
        {
          label: 'Find a legal aid office (LSC)',
          agencyUrl: 'https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help',
        },
      ],
      [
        {
          label: 'National Archives — 14th Amendment (Milestone Documents)',
          url: 'https://www.archives.gov/milestone-documents/14th-amendment',
          licenseTag: 'public-domain',
        },
        {
          label: 'U.S. Reports, 347 U.S. 483 — Brown v. Board of Education',
          url: 'https://tile.loc.gov/storage-services/service/ll/usrep/usrep347/usrep347483/usrep347483.pdf',
          licenseTag: 'public-domain',
        },
      ],
      [
        {
          term: 'Equal Protection Clause',
          wexUrl: 'https://www.law.cornell.edu/wex/equal_protection',
        },
        { term: 'incorporation doctrine', wexUrl: 'https://www.law.cornell.edu/wex/incorporation' },
      ],
    ),
  },
  {
    snapshotId: 'legal-15th-amendment',
    explainer: explainer(
      'The Fifteenth Amendment, ratified February 3, 1870, provides that "The right of citizens of the United States to vote shall not be denied or abridged by the United States or by any State on account of race, color, or previous condition of servitude."',
      [
        'It bars race-based denial of the vote by any level of government.',
        'It does not create a general right to vote. It bars one specific reason for taking the vote away, which left States wide room to set other qualifications.',
        'Section 2 gives Congress power to enforce it by appropriate legislation — the authority Congress used to pass the Voting Rights Act.',
      ],
      [
        'Black men voted in large numbers during Reconstruction and elected hundreds of Black officials across the South.',
        'After Reconstruction ended, States used poll taxes, literacy tests, grandfather clauses, white primaries, and violence to strip that vote away. None of these named race, so each was defended as race-neutral.',
        'Enforcement took 95 years. The Voting Rights Act of 1965 opens by stating its purpose: "To enforce the fifteenth amendment to the Constitution of the United States."',
      ],
      [
        {
          label: 'Report a voting rights violation (DOJ Civil Rights Division)',
          agencyUrl: 'https://civilrights.justice.gov/',
        },
        {
          label: 'Find your election office (USA.gov)',
          agencyUrl: 'https://www.usa.gov/election-office',
        },
      ],
      [
        {
          label: 'National Archives — 15th Amendment (Milestone Documents)',
          url: 'https://www.archives.gov/milestone-documents/15th-amendment',
          licenseTag: 'public-domain',
        },
        {
          label: 'Statutes at Large — 79 Stat. 437 (Voting Rights Act of 1965)',
          url: 'https://www.govinfo.gov/content/pkg/STATUTE-79/pdf/STATUTE-79-Pg437.pdf',
          licenseTag: 'public-domain',
        },
      ],
      [{ term: 'poll tax', wexUrl: 'https://www.law.cornell.edu/wex/poll_tax' }],
    ),
  },
  {
    snapshotId: 'legal-title-vii-regs',
    explainer: explainer(
      '29 C.F.R. Part 1604, the EEOC\'s "Guidelines on Discrimination Because of Sex," interprets Title VII of the Civil Rights Act of 1964 and was issued under 42 U.S.C. § 2000e-12 (source: 37 Fed. Reg. 6836, Apr. 5, 1972).',
      [
        "These are the agency's interpretations, not a statute. Courts weigh them; the binding law is Title VII itself.",
        'Part 1604 reads the "bona fide occupational qualification" exception narrowly — customer or coworker preference is not a lawful reason to hire by sex, and labeling roles "men\'s jobs" or "women\'s jobs" is not permitted.',
        'Section 1604.11 defines sexual harassment: unwelcome sexual conduct that is made a condition of employment, is used as the basis for employment decisions, or creates an intimidating, hostile, or offensive working environment.',
        'One piece has been withdrawn. The Commission rescinded § 1604.11(c), the supervisor-liability standard, after Burlington Industries v. Ellerth and Faragher v. City of Boca Raton (both 524 U.S., 1998); the current CFR carries it as [Reserved].',
      ],
      [
        '"Sex" reached Title VII through a floor amendment during the 1964 debate, and the EEOC needed years to work out what it required. Part 1604 is the record of that work.',
        'The rules matter most where race and sex discrimination compound. Black women bringing harassment and hiring claims rely on the hostile-environment standard in § 1604.11 and on the narrow BFOQ reading in § 1604.2.',
        'Title VI of the same 1964 Act ties federal funding to nondiscrimination; Title VII and these guidelines govern the workplace.',
      ],
      [
        {
          label: 'File an employment discrimination charge (EEOC)',
          agencyUrl: 'https://www.eeoc.gov/filing-charge-discrimination',
          note: 'Filing deadlines are short — commonly 180 or 300 days from the incident.',
        },
        {
          label: 'Report employment discrimination by a public employer (DOJ)',
          agencyUrl: 'https://civilrights.justice.gov/',
        },
      ],
      [
        {
          label: 'eCFR — 29 C.F.R. Part 1604 (current text)',
          url: 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1604',
          licenseTag: 'public-domain',
        },
        {
          label: 'Statutes at Large — 78 Stat. 241 (Civil Rights Act of 1964)',
          url: 'https://www.govinfo.gov/content/pkg/STATUTE-78/pdf/STATUTE-78-Pg241.pdf',
          licenseTag: 'public-domain',
        },
      ],
      [
        {
          term: 'bona fide occupational qualification',
          wexUrl:
            'https://www.law.cornell.edu/wex/bona_fide_occupational_qualifications_(bfoq)_defense',
        },
        {
          term: 'hostile work environment',
          wexUrl: 'https://www.law.cornell.edu/wex/hostile_work_environment',
        },
      ],
    ),
  },
  {
    snapshotId: 'legal-ga-sb202',
    explainer: explainer(
      'Georgia Senate Bill 202, the Election Integrity Act of 2021, effective March 25, 2021, rewrote much of the state election code: absentee ballot rules, drop box limits, advance voting hours, conduct near polling places, and state authority over county election boards.',
      [
        "Absentee voting now turns on ID numbers. A registrar compares the Georgia driver's license or state ID number and date of birth written on the ballot envelope against office records, replacing signature match as the primary check.",
        'Drop boxes were written into law and capped. Each county must have at least one, but additional boxes are limited to the lesser of one per 100,000 active registered voters or the number of advance voting locations; boxes sit inside advance voting locations and are open only during advance voting hours.',
        'The Act bars any person from giving "money or gifts, including, but not limited to, food and drink" to voters within 150 feet of a polling place building, within the polling place, or within 25 feet of any voter in line. Poll officers may still provide self-service water.',
        'It restructured oversight, making the Secretary of State a nonvoting ex officio member of the State Election Board and creating performance reviews and replacement superintendents for county election offices.',
      ],
      [
        'The bill followed the 2020 general election and the January 2021 Senate runoffs, in which Black voters in metro Atlanta turned out at high rates and used absentee and drop-box voting heavily.',
        "The provisions bite unevenly. Drop-box caps tied to population reduced boxes most in the state's largest and most heavily Black counties, and long lines have historically been concentrated in those same precincts.",
        'The United States sued Georgia over the Act in June 2021; the Department of Justice dismissed that suit in March 2025. Private challenges have continued.',
        'This is a state law, and Georgia is no longer subject to preclearance — after Shelby County v. Holder (2013), changes like these take effect without advance federal review.',
      ],
      [
        {
          label: 'Report a voting rights violation (DOJ Civil Rights Division)',
          agencyUrl: 'https://civilrights.justice.gov/',
        },
        {
          label: 'Georgia My Voter Page — registration, ballot, and polling place status',
          agencyUrl: 'https://mvp.sos.ga.gov/',
        },
        {
          label: 'Find your election office (USA.gov)',
          agencyUrl: 'https://www.usa.gov/election-office',
        },
      ],
      [
        {
          label: 'Georgia General Assembly — S.B. 202 as passed (full text PDF)',
          url: 'https://www.legis.ga.gov/api/legislation/document/20212022/201498',
          licenseTag: 'link-only',
        },
        {
          label: 'Georgia General Assembly — S.B. 202 bill page',
          url: 'https://www.legis.ga.gov/legislation/59827',
          licenseTag: 'link-only',
        },
      ],
      [{ term: 'absentee ballot', wexUrl: 'https://www.law.cornell.edu/wex/absentee_ballot' }],
    ),
  },
  {
    snapshotId: 'legal-sffa-2023',
    explainer: explainer(
      'Students for Fair Admissions, Inc. v. President and Fellows of Harvard College, 600 U.S. 181 (2023), decided June 29, 2023, held that "Harvard\'s and UNC\'s admissions programs violate the Equal Protection Clause of the Fourteenth Amendment."',
      [
        'The Court gave four reasons: the programs lacked measurable objectives that would justify using race, used race in a negative way, involved racial stereotyping, and had no meaningful end point.',
        'The ruling reached both schools. The Harvard case came up under Title VI of the Civil Rights Act of 1964 and the UNC case under the Equal Protection Clause; the Court decided them together.',
        'Applicants may still write about race. The opinion states that "nothing in this opinion should be construed as prohibiting universities from considering an applicant\'s discussion of how race affected his or her life, be it through discrimination, inspiration, or otherwise."',
        'That opening is narrow. The Court added that a benefit must be tied to the student\'s own courage, determination, or contribution — "the student must be treated based on his or her experiences as an individual — not on the basis of race" — and that universities may not rebuild the same regime through essays.',
      ],
      [
        'The decision reversed roughly 45 years of practice permitted under Regents of the University of California v. Bakke (1978) and Grutter v. Bollinger (2003).',
        'It rests on the same Equal Protection Clause as Brown v. Board of Education. The Court invoked Brown directly, treating a rule that once dismantled segregation as one that now bars race-conscious admissions.',
        'The opinion notes the practical stakes at Harvard, where the record showed race was "a determinative tip for" a significant share of admitted African American and Hispanic applicants.',
        'Military service academies were not before the Court; the majority expressly reserved that question in a footnote.',
      ],
      [
        {
          label: 'File a school discrimination complaint (ED Office for Civil Rights)',
          agencyUrl: 'https://www2.ed.gov/about/offices/list/ocr/complaintintro.html',
        },
        {
          label: 'File an education civil-rights complaint (DOJ)',
          agencyUrl: 'https://civilrights.justice.gov/',
        },
      ],
      [
        {
          label: 'Supreme Court — slip opinion, No. 20-1199 (PDF)',
          url: 'https://www.supremecourt.gov/opinions/22pdf/20-1199_hgdj.pdf',
          licenseTag: 'public-domain',
        },
        {
          label: 'CourtListener — Students for Fair Admissions v. Harvard',
          url: 'https://www.courtlistener.com/opinion/9383451/students-for-fair-admissions-inc-v-president-and-fellows-of-harvard/',
          licenseTag: 'public-domain',
        },
      ],
      [
        {
          term: 'strict scrutiny',
          wexUrl: 'https://www.law.cornell.edu/wex/strict_scrutiny',
        },
        {
          term: 'Equal Protection Clause',
          wexUrl: 'https://www.law.cornell.edu/wex/equal_protection',
        },
      ],
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
    'https://www.govinfo.gov/content/pkg/STATUTE-78/pdf/STATUTE-78-Pg241.pdf',
  ),
  lawFact(
    'BB-F-000011',
    'voting-rights-act-1965-enacted',
    'The Voting Rights Act of 1965 was enacted on August 6, 1965, outlawing literacy tests and requiring federal oversight of election changes in covered jurisdictions.',
    'Voting Rights Act of 1965 enacted',
    'ent_seed_law_vra_1965',
    '1965',
    'https://www.govinfo.gov/content/pkg/STATUTE-79/pdf/STATUTE-79-Pg437.pdf',
  ),
  lawFact(
    'BB-F-000012',
    'fair-housing-act-1968-enacted',
    'The Fair Housing Act was enacted April 11, 1968 as Title VIII of Pub. L. 90-284, 82 Stat. 81, prohibiting discrimination in the sale, rental, and financing of housing based on race, color, religion, and national origin; Congress added sex in 1974 and disability and familial status in 1988.',
    'Fair Housing Act of 1968 enacted',
    'ent_seed_law_fha_1968',
    '1968',
    'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section3604&num=0&edition=prelim',
  ),
  lawFact(
    'BB-F-000013',
    'section-1983-civil-rights-statute',
    '42 U.S.C. § 1983 provides a federal cause of action against state and local officials who violate constitutional or statutory rights under color of law.',
    '42 U.S.C. § 1983 — civil rights statute',
    'ent_seed_law_1983',
    '1871',
    'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1983&num=0&edition=prelim',
  ),
  lawFact(
    'BB-F-000014',
    'brown-v-board-1954-holding',
    'In Brown v. Board of Education (1954), the Supreme Court held that racial segregation in public schools violates the Equal Protection Clause of the Fourteenth Amendment.',
    'Brown v. Board — school segregation unconstitutional',
    'ent_seed_law_brown_1954',
    '1954',
    'https://tile.loc.gov/storage-services/service/ll/usrep/usrep347/usrep347483/usrep347483.pdf',
    'legal_case',
  ),
  lawFact(
    'BB-F-000015',
    'shelby-county-2013-preclearance',
    'In Shelby County v. Holder (2013), the Supreme Court struck down the Voting Rights Act coverage formula that determined which jurisdictions required federal preclearance.',
    'Shelby County — VRA preclearance formula struck',
    'ent_seed_law_shelby_2013',
    '2013',
    'https://tile.loc.gov/storage-services/service/ll/usrep/usrep570/usrep570529/usrep570529.pdf',
    'legal_case',
  ),
  lawFact(
    'BB-F-000016',
    'thirteenth-amendment-abolition',
    'The Thirteenth Amendment abolished slavery and involuntary servitude except as punishment for a crime after conviction.',
    '13th Amendment abolished slavery',
    'ent_seed_law_13th',
    '1865',
    'https://www.archives.gov/milestone-documents/13th-amendment',
  ),
  lawFact(
    'BB-F-000017',
    'fourteenth-amendment-equal-protection',
    "The Fourteenth Amendment guarantees equal protection of the laws and due process to all persons within a state's jurisdiction.",
    '14th Amendment — equal protection',
    'ent_seed_law_14th',
    '1868',
    'https://www.archives.gov/milestone-documents/14th-amendment',
  ),
  lawFact(
    'BB-F-000018',
    'fifteenth-amendment-voting-rights',
    'The Fifteenth Amendment prohibits denying the right to vote based on race, color, or previous condition of servitude.',
    '15th Amendment — voting rights by race',
    'ent_seed_law_15th',
    '1870',
    'https://www.archives.gov/milestone-documents/15th-amendment',
  ),
  lawFact(
    'BB-F-000019',
    'title-vii-eeoc-regulations',
    "29 C.F.R. Part 1604, the EEOC's Guidelines on Discrimination Because of Sex, was issued at 37 Fed. Reg. 6836 (Apr. 5, 1972) under 42 U.S.C. § 2000e-12 and interprets Title VII of the Civil Rights Act of 1964.",
    'EEOC sex-discrimination guidelines (29 CFR 1604)',
    'ent_seed_law_title_vii_regs',
    '1972',
    'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1604',
  ),
  lawFact(
    'BB-F-000020',
    'georgia-sb202-2021-enacted',
    'Georgia SB 202, the Election Integrity Act of 2021, took effect March 25, 2021, changing absentee ballot identification, capping and relocating drop boxes, revising advance voting hours, and barring gifts of food and drink to voters within 150 feet of a polling place.',
    'Georgia SB 202 election law (2021)',
    'ent_seed_law_ga_sb202',
    '2021',
    'https://www.legis.ga.gov/api/legislation/document/20212022/201498',
  ),
  lawFact(
    'BB-F-000021',
    'sffa-v-harvard-2023-holding',
    'In Students for Fair Admissions v. Harvard (2023), the Supreme Court held that race-based affirmative action in college admissions violates the Equal Protection Clause.',
    'SFFA v. Harvard — race-conscious admissions barred',
    'ent_seed_law_sffa_2023',
    '2023',
    'https://www.supremecourt.gov/opinions/22pdf/20-1199_hgdj.pdf',
    'legal_case',
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
