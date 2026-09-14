/**
 * Unit tests for the single deterministic per-entity release/projection builder
 * (the related workstream). See ./release-builder.ts's module doc comment for the contract.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildNotabilityBasisNote,
  buildReleaseEntityArtifacts,
  buildReleaseNotabilityBasis,
  isKillingPredicate,
  inferNotabilityCriterionFromClaim,
  isRacialTerrorKillingPredicate,
  isAccusationPredicate,
  isRacialTerrorClaim,
  isRacialTerrorRecord,
  computeReleaseResearchCoverage,
  formatClaimInclusionNote,
  recordEvidenceInputs,
  inferNotabilityCriterionFromClaim,
  resolveReleaseClaimId,
  resolveReleaseEntityReferences,
  type ReleaseClaimProjection,
  type ReleaseSourceEntity,
} from './release-builder.js';
import { NRHP_SUMMARY_FILLER, NRHP_SUMMARY_TRAILER } from './template-summary-signatures.js';
import { sanitizePublicProseText } from './public-render.js';
import { PUBLIC_PRECISION_TIERS } from '@repo/domain-core/geography/precision';

const CONTEXT = { releaseId: 'release-2026-07-18', generatedAt: '2026-07-18T00:00:00.000Z' };

function baseEntry(overrides: Partial<ReleaseSourceEntity> = {}): ReleaseSourceEntity {
  return {
    id: 'ent_example_001',
    kind: 'place',
    displayName: 'Example Site',
    summary: 'A'.repeat(130),
    jurisdictionLabel: 'Atlanta, Georgia',
    locationPrecision: 'institution',
    locationLabel: '123 Example Street area',
    lat: 33.749,
    lng: -84.388,
    topicIds: ['church'],
    claims: [
      {
        predicate: 'founded_year',
        object: '1900',
        confidenceLevel: 'high',
        citationSource: 'Example Source',
        citationLabel: 'Example Citation',
      },
    ],
    ...overrides,
  };
}

test('resolveReleaseClaimId is stable and deterministic for a given entry+index', () => {
  const entry = baseEntry();
  const claim = entry.claims![0]!;
  const id1 = resolveReleaseClaimId(entry, claim, 0);
  const id2 = resolveReleaseClaimId(entry, claim, 0);
  assert.equal(id1, id2);
  assert.equal(id1, 'claim_example_001_01');
});

test('resolveReleaseClaimId respects an explicit id when present', () => {
  const entry = baseEntry();
  const claim = { ...entry.claims![0]!, id: 'claim_custom' };
  assert.equal(resolveReleaseClaimId(entry, claim, 0), 'claim_custom');
});

test('inferNotabilityCriterionFromClaim recognizes a documented "first" claim', () => {
  assert.equal(
    inferNotabilityCriterionFromClaim('recognized_as', 'the first Black woman to do X'),
    'first_to_do_x',
  );
});

test('an invention falls back to documented_contribution, never documented_site', () => {
  // The old fallback rested on "every record is, by construction, a documented site". That
  // stopped being true when `invention` became a kind, and the rubric text it selected told a
  // reader that Latimer's carbon-manufacturing process was a sit-in lunch counter's kind of thing.
  assert.equal(
    inferNotabilityCriterionFromClaim(
      'documented_contribution',
      'US 252,386, titled "Process of Manufacturing Carbons," names Lewis H. Latimer.',
      'invention',
    ),
    'documented_contribution',
  );
  // Every other kind is untouched.
  assert.equal(
    inferNotabilityCriterionFromClaim(
      'documented_site',
      'A church that stood through it.',
      'place',
    ),
    'documented_site',
  );
  assert.equal(
    inferNotabilityCriterionFromClaim('documented_site', 'A church that stood through it.'),
    'documented_site',
  );
  // A keyword match still wins over the kind fallback: Jennings's grant is the earliest known US
  // patent to a Black inventor, and that is a documented first whatever the record's kind.
  assert.equal(
    inferNotabilityCriterionFromClaim(
      'documented_contribution',
      'often cited as the first US patent issued to a Black inventor',
      'invention',
    ),
    'first_to_do_x',
  );
});

test('inferNotabilityCriterionFromClaim recognizes a landmark/register claim', () => {
  assert.equal(
    inferNotabilityCriterionFromClaim(
      'listed_on',
      'the National Register of Historic Places in 1984',
    ),
    'landmark_or_national_register',
  );
});

test('inferNotabilityCriterionFromClaim falls back to documented_site when no marker matches', () => {
  assert.equal(inferNotabilityCriterionFromClaim('founded_year', '1900'), 'documented_site');
});

test('buildReleaseNotabilityBasis groups claims by predicate with real evidenceIds', () => {
  const entry = baseEntry({
    claims: [
      {
        predicate: 'founded_year',
        object: '1900',
        confidenceLevel: 'high',
        citationSource: 'Source A',
        citationLabel: 'Citation A',
      },
      {
        predicate: 'founded_year',
        object: '1900 (corroborating)',
        confidenceLevel: 'medium',
        citationSource: 'Source B',
        citationLabel: 'Citation B',
      },
      {
        predicate: 'listed_on',
        object: 'the National Register of Historic Places',
        confidenceLevel: 'high',
        citationSource: 'Source C',
        citationLabel: 'Citation C',
      },
    ],
  });
  const basis = buildReleaseNotabilityBasis(entry);
  // One record, not two: the National Register listing is a reason this place is in the catalog
  // and "Founded year 1900." is not. See M1 in buildReleaseNotabilityBasis.
  assert.equal(basis.length, 1);
  assert.equal(basis[0]!.criterion, 'landmark_or_national_register');

  // Grouping, evidenceIds and note prose are observable on a record where nothing is positively
  // identified, so every claim survives and the fallback speaks.
  const unidentified = baseEntry({
    claims: entry.claims!.filter((claim) => claim.predicate === 'founded_year'),
  });
  const fallbackBasis = buildReleaseNotabilityBasis(unidentified);
  assert.equal(fallbackBasis.length, 1);
  const foundedBasis = fallbackBasis.find((b) => b.evidenceIds.length === 2);
  assert.ok(foundedBasis, 'expected one basis record covering both founded_year claims');
  assert.equal(foundedBasis!.criterion, 'documented_site');
  assert.match(foundedBasis!.note, /^Founded year 1900\./);
  assert.doesNotMatch(foundedBasis!.note, /Cited from/i);
  assert.doesNotMatch(foundedBasis!.note, /documented site of a historically significant/i);
  const landmarkBasis = basis.find((b) => b.criterion === 'landmark_or_national_register');
  assert.ok(landmarkBasis, 'expected a landmark_or_national_register basis record');
  assert.equal(landmarkBasis!.evidenceIds.length, 1);
  assert.match(landmarkBasis!.note, /^Listed on the National Register of Historic Places\./);
  assert.doesNotMatch(landmarkBasis!.note, /Cited from/i);
});

test('formatClaimInclusionNote / buildNotabilityBasisNote read as prose, not predicate dumps', () => {
  assert.equal(
    formatClaimInclusionNote(
      'served_as',
      "the Birmingham campaign's headquarters from April through May 1963",
    ),
    "Served as the Birmingham campaign's headquarters from April through May 1963.",
  );
  assert.equal(
    formatClaimInclusionNote('bombed_on', 'May 11, 1963, the day after the truce was announced'),
    'Bombed on May 11, 1963, the day after the truce was announced.',
  );
  assert.equal(
    buildNotabilityBasisNote('served_as', [
      {
        id: 'c1',
        predicate: 'served_as',
        object: "the campaign's headquarters",
        confidenceLevel: 'high',
        citationSource: 'nps.gov',
        citationLabel: 'NPS',
      },
    ]),
    "Served as the campaign's headquarters.",
  );
});

test('a lynching claim is documented_racial_terror, never documented_site', () => {
  // Alma Howze's live record said her basis for inclusion was that she is "a documented site of
  // a historically significant event or practice (a sit-in lunch counter, a Freedom School...)".
  assert.equal(
    inferNotabilityCriterionFromClaim(
      'was lynched on',
      'December 20, 1918, in Shubuta, Mississippi',
      'person',
    ),
    'documented_racial_terror',
  );
  assert.equal(
    inferNotabilityCriterionFromClaim(
      'was a victim of',
      'racial terror lynching in the Jim Crow South',
      'person',
    ),
    'documented_racial_terror',
  );
});

test('racial terror is decided before first_to_do_x, so a killing never reads as an achievement', () => {
  assert.equal(
    inferNotabilityCriterionFromClaim('was the first Black man lynched in', 'the county', 'person'),
    'documented_racial_terror',
  );
});

test('a place name containing "lynch" is not a racial-terror claim', () => {
  assert.notEqual(
    inferNotabilityCriterionFromClaim('was founded in', 'Lynchburg, Virginia', 'place'),
    'documented_racial_terror',
  );
});

test('someone who campaigned against lynching is not filed as a victim of it', () => {
  // Every one of these is a real record the first version of this matcher reclassified, because
  // it read the claim object as well as the predicate. Ida B. Wells reported on lynching; the
  // Richmond Planet campaigned against it. The criterion is for the people who were killed.
  assert.equal(
    isRacialTerrorClaim('launched_crusade', 'After a white mob lynched her friend Thomas Moss'),
    false,
  );
  assert.equal(
    isRacialTerrorClaim(
      'published_from',
      "Under Mitchell's editorship the Planet campaigned against lynching",
    ),
    false,
  );
  assert.equal(
    isRacialTerrorClaim(
      'advocated for due process by condemning the lynching of Wright Smith',
      'condemned lynching',
    ),
    false,
  );
  assert.equal(isRacialTerrorClaim('experienced racial violence in', '1923'), false);
});

test('a death that is not racial terror does not become racial terror', () => {
  // Doris Miller died aboard the USS Liscome Bay. A bare "killed" verb matched him once.
  assert.equal(isRacialTerrorClaim('was killed in action', 'at Pearl Harbor'), false);
  // A hanging can be a judicial execution — the memorial source data carries Nat Turner that way.
  assert.equal(isRacialTerrorClaim('was executed after', 'the 1831 rebellion'), false);
});

test('a racial-terror killing is recognized from the predicate alone', () => {
  assert.equal(isRacialTerrorClaim('was lynched on', 'October 20, 1875'), true);
  assert.equal(
    isRacialTerrorClaim('was the victim of a hate crime resulting in federal convictions', ''),
    true,
  );
  assert.equal(
    isRacialTerrorClaim(
      'died as a result of racial terror lynching',
      'in the post-Reconstruction South',
    ),
    true,
  );
});

test('buildReleaseNotabilityBasis refuses an accusation against the subject as an inclusion basis', () => {
  const entry = baseEntry({
    displayName: 'Alma Howze',
    claims: [
      {
        predicate: 'was lynched on',
        object: 'December 20, 1918, in Shubuta, Mississippi',
        confidenceLevel: 'high',
        citationSource: 'Source A',
        citationLabel: 'Citation A',
      },
      {
        predicate: 'was accused of',
        object: 'alleged murder of a dentist',
        confidenceLevel: 'medium',
        citationSource: 'Source B',
        citationLabel: 'Citation B',
      },
    ],
  });
  const basis = buildReleaseNotabilityBasis(entry);
  assert.equal(basis.length, 1, 'the accusation must not become a basis record');
  assert.equal(basis[0]!.criterion, 'documented_racial_terror');
  assert.doesNotMatch(basis.map((b) => b.note).join(' '), /accus|alleg/i);
});

test('an arrest is not an accusation — a civil-rights record keeps it as a basis', () => {
  assert.equal(isAccusationPredicate('was arrested at'), false);
  assert.equal(isAccusationPredicate('resulting in federal convictions'), false);
  assert.equal(isAccusationPredicate('used convict labor during Reconstruction'), false);
  assert.equal(isAccusationPredicate('was accused of'), true);
  assert.equal(isAccusationPredicate('was falsely accused of'), true);
  assert.equal(isAccusationPredicate('followed accusation of'), true);
});

test('the Emanuel Nine are a racial-terror record even when no single claim says so', () => {
  // Tywanza Sanders's live record carried the predicate `killed` six times, his own name as every
  // object, and no context at all — the massacre is named only in his summary. Read one claim at a
  // time there is nothing to match, which is why the lynching pass published all nine of the
  // Emanuel Nine as documented SITES.
  const claims = [
    {
      id: 'claim_1',
      predicate: 'killed',
      object: 'Tywanza Sanders',
      citationSource: 'Source A',
      citationLabel: 'Citation A',
      confidenceLevel: 'high' as const,
    },
  ];
  assert.equal(isRacialTerrorClaim('killed', 'Tywanza Sanders'), false);
  assert.equal(
    isRacialTerrorRecord(
      {
        kind: 'person',
        displayName: 'Tywanza Sanders',
        summary: 'Among the nine victims killed during the white-supremacist massacre at Emanuel.',
      },
      claims as never,
    ),
    true,
  );
});

test('a killing record states the killing, not the date and street it happened on', () => {
  const entry = baseEntry({
    kind: 'person',
    displayName: 'Susie Jackson',
    summary: 'Killed in the white-supremacist massacre at Emanuel AME in Charleston.',
    claims: [
      {
        predicate: 'killed',
        object: 'Susie Jackson',
        confidenceLevel: 'high',
        citationSource: 'Source A',
        citationLabel: 'Citation A',
      },
      {
        predicate: 'date',
        object: 'June 17, 2015',
        confidenceLevel: 'high',
        citationSource: 'Source A',
        citationLabel: 'Citation A',
      },
      {
        predicate: 'location',
        object: '110 Calhoun Street',
        confidenceLevel: 'high',
        citationSource: 'Source A',
        citationLabel: 'Citation A',
      },
    ],
  });
  const basis = buildReleaseNotabilityBasis(entry);
  assert.equal(basis.length, 1, 'the date and the street are not reasons she is in the catalog');
  assert.equal(basis[0]!.criterion, 'documented_racial_terror');
  assert.equal(basis[0]!.note, 'Killed.');
});

test('dropping the metadata off a killing record never drops a documented first', () => {
  // Both regressions the live dry run caught. Elmer Jackson was one of three men lynched in Duluth
  // in 1920; his `only_or_oldest` basis records the only widely known lynching in Minnesota, and a
  // first draft of the metadata rule discarded it along with the date and the street.
  const entry = baseEntry({
    kind: 'person',
    displayName: 'Elmer Jackson',
    summary: 'Lynched by a white mob in Duluth, Minnesota, on June 15, 1920.',
    claims: [
      {
        predicate: 'was lynched on',
        object: 'June 15, 1920, in Duluth, Minnesota, by a white mob',
        confidenceLevel: 'high',
        citationSource: 'Source A',
        citationLabel: 'Citation A',
      },
      {
        predicate: 'is one of the victims of the only widely known lynching of',
        object: 'African Americans in Minnesota',
        confidenceLevel: 'high',
        citationSource: 'Source A',
        citationLabel: 'Citation A',
      },
      {
        predicate: 'date',
        object: 'June 15, 1920',
        confidenceLevel: 'high',
        citationSource: 'Source A',
        citationLabel: 'Citation A',
      },
    ],
  });
  const criteria = buildReleaseNotabilityBasis(entry).map((b) => b.criterion);
  assert.ok(criteria.includes('documented_racial_terror'));
  assert.ok(criteria.includes('only_or_oldest'), 'the superlative must survive the metadata drop');
  assert.equal(criteria.length, 2, 'the bare date is not a reason he is in the catalog');
});

test('a massacre with a landmark listing keeps both the listing and the killing', () => {
  // The Elaine Massacre and Ell Persons's lynching site are NRHP-listed. A draft of the metadata
  // rule kept only the listing and silently dropped the racial-terror basis — the massacre stopped
  // being the reason the record existed, which is the exact defect this pass is here to fix.
  const entry = baseEntry({
    kind: 'event',
    displayName: 'Elaine Massacre',
    summary: 'Black sharecroppers organized in Phillips County; white mobs and federal troops.',
    claims: [
      {
        predicate: 'resulted in',
        object: 'Estimates of Black residents killed by white mobs range into the hundreds',
        confidenceLevel: 'high',
        citationSource: 'Source A',
        citationLabel: 'Citation A',
      },
      {
        predicate: 'listed on',
        object: 'the National Register of Historic Places',
        confidenceLevel: 'high',
        citationSource: 'Source A',
        citationLabel: 'Citation A',
      },
    ],
  });
  const criteria = buildReleaseNotabilityBasis(entry).map((b) => b.criterion);
  assert.ok(criteria.includes('documented_racial_terror'), 'the massacre is why the record exists');
  assert.ok(criteria.includes('landmark_or_national_register'));
});

test('the Klan naming a victim is racial terror, not movement significance', () => {
  const claims = [
    {
      id: 'claim_1',
      predicate: 'killed_in',
      object: '16th Street Baptist Church bombing',
      citationSource: 'Source A',
      citationLabel: 'Citation A',
      confidenceLevel: 'high' as const,
    },
    {
      id: 'claim_2',
      predicate: 'victim_of',
      object: 'Ku Klux Klan',
      citationSource: 'Source A',
      citationLabel: 'Citation A',
      confidenceLevel: 'high' as const,
    },
  ];
  assert.equal(
    isRacialTerrorRecord(
      { kind: 'person', displayName: 'Denise McNair', summary: 'Killed in Birmingham in 1963.' },
      claims as never,
    ),
    true,
  );
});

test('a massacre is a racial-terror record although it carries no killing predicate', () => {
  // The Tulsa Race Massacre's claims are `occurred in`, `targeted`, `estimated deaths` and
  // `destroyed`. Nothing there says anyone was killed in a predicate a test can read.
  const claims = [
    {
      id: 'claim_1',
      predicate: 'occurred in',
      object: 'Greenwood District, Tulsa, Oklahoma',
      citationSource: 'Source A',
      citationLabel: 'Citation A',
      confidenceLevel: 'high' as const,
    },
    {
      id: 'claim_2',
      predicate: 'perpetrators',
      object: 'White mob',
      citationSource: 'Source A',
      citationLabel: 'Citation A',
      confidenceLevel: 'high' as const,
    },
  ];
  assert.equal(
    isRacialTerrorRecord(
      { kind: 'event', displayName: 'Tulsa Race Massacre', summary: 'A two-day attack.' },
      claims as never,
    ),
    true,
  );
});

test('a killing by police is not swept into racial terror', () => {
  // Orangeburg, Breonna Taylor, Trayvon Martin and Eric Garner rest on a different documentary
  // record and get `documented_racial_killing` once it is ratified. Until then they must not be
  // relabelled by this rule — the perpetrator half of the test is what holds the line.
  assert.equal(
    isRacialTerrorRecord(
      {
        kind: 'event',
        displayName: 'Orangeburg Massacre',
        summary: 'Highway patrolmen opened fire on Black students protesting segregation.',
      },
      [
        {
          id: 'c1',
          predicate: 'killed',
          object: 'Samuel Hammond, Henry Smith and Delano Middleton',
          citationSource: 'S',
          citationLabel: 'C',
          confidenceLevel: 'high' as const,
        },
      ] as never,
    ),
    false,
  );
  assert.equal(
    isRacialTerrorRecord(
      {
        kind: 'person',
        displayName: 'Breonna Taylor',
        summary: 'Killed by Louisville Metro Police serving a search warrant; fueled protests.',
      },
      [
        {
          id: 'c1',
          predicate: 'killed_during',
          object: 'the service of a Louisville Metro Police search warrant',
          citationSource: 'S',
          citationLabel: 'C',
          confidenceLevel: 'high' as const,
        },
      ] as never,
    ),
    false,
  );
});

test('widening the window to the whole record still does not file the chronicler as the victim', () => {
  // Ida B. Wells's record is saturated with lynching; requiring a killing predicate is what keeps
  // her out. Same for the Richmond Planet, which campaigned against it for decades.
  assert.equal(
    isRacialTerrorRecord(
      {
        kind: 'person',
        displayName: 'Ida B. Wells',
        summary: 'Her 1892 anti-lynching crusade, launched after a white mob murdered her friends.',
      },
      [
        {
          id: 'c1',
          predicate: 'launched_crusade',
          object: 'After a white mob lynched her friend Thomas Moss',
          citationSource: 'S',
          citationLabel: 'C',
          confidenceLevel: 'high' as const,
        },
      ] as never,
    ),
    false,
  );
  assert.equal(
    isRacialTerrorRecord(
      {
        kind: 'publication',
        displayName: 'Richmond Planet',
        summary: 'Under Mitchell the Planet used its pages for antilynching campaigns.',
      },
      [
        {
          id: 'c1',
          predicate: 'published_from',
          object: 'the Planet campaigned against lynching and reported on disfranchisement',
          citationSource: 'S',
          citationLabel: 'C',
          confidenceLevel: 'high' as const,
        },
      ] as never,
    ),
    false,
  );
});

test('a sailor killed in action is not a racial-terror record', () => {
  assert.equal(
    isRacialTerrorRecord(
      {
        kind: 'person',
        displayName: 'Doris Miller',
        summary: 'Awarded the Navy Cross for Pearl Harbor; killed aboard the USS Liscome Bay.',
      },
      [
        {
          id: 'c1',
          predicate: 'was killed in action',
          object: 'aboard the USS Liscome Bay',
          citationSource: 'S',
          citationLabel: 'C',
          confidenceLevel: 'high' as const,
        },
      ] as never,
    ),
    false,
  );
});

test('a claim object that merely repeats the subject name does not become part of the sentence', () => {
  const claims = [
    {
      id: 'claim_1',
      predicate: 'was lynched',
      object: 'Gus Roberson',
      citationSource: 'Source A',
      citationLabel: 'Citation A',
      confidenceLevel: 'high' as const,
    },
  ];
  assert.equal(
    buildNotabilityBasisNote('was lynched', claims as never, 'Gus Roberson'),
    'Was lynched.',
  );
});

test('buildReleaseNotabilityBasis never fabricates evidence for an uncited claim', () => {
  const entry = baseEntry({
    claims: [
      {
        predicate: 'founded_year',
        object: '1900',
        confidenceLevel: 'high',
        citationSource: '   ',
        citationLabel: 'Citation A',
      },
    ],
  });
  const basis = buildReleaseNotabilityBasis(entry);
  assert.equal(basis.length, 1);
  assert.deepEqual(basis[0]!.evidenceIds, []);
});

/**
 * Prose with no registered template fingerprint — the normal case, where coverage is decided by
 * the claim set alone. The tests below that exercise the fingerprint cap pass a templated summary
 * instead, so the two axes stay independently testable (repo-vymq).
 */
const RESEARCHED_SUMMARY =
  'Founded in 1881 by formerly enslaved families, the school served the county until 1968 and its ' +
  'graduates led the local voter-registration drives of the following decade.';

/** One claim citing one document — the floor case. */
test('computeReleaseResearchCoverage: a single cited claim is minimal', () => {
  const claims: readonly ReleaseClaimProjection[] = [
    {
      id: 'c1',
      predicate: 'p',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: 'S',
      citationLabel: 'L',
    },
  ];
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'minimal');
});

/** repo-z1pw, the exact live shape: the nrhp-black-heritage lane carves a listing fact and a
 *  significance fact out of ONE registry index row, both citing that row's own URL. Counting
 *  claims graded this 'partial' and suppressed the thin-record notice on 2,436 live records. */
test('computeReleaseResearchCoverage: many claims citing ONE document is minimal, not partial', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 3 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'catalog.archives.gov',
    citationHref: 'https://catalog.archives.gov/id/77843341',
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'minimal');
});

/** Query strings, anchors and trailing slashes must not split one document into several — that
 *  would recreate the inflation this function exists to prevent. */
test('computeReleaseResearchCoverage: url noise does not make one document look like several', () => {
  const hrefs = [
    'https://catalog.archives.gov/id/77843341',
    'https://www.catalog.archives.gov/id/77843341/',
    'https://catalog.archives.gov/id/77843341?utm_source=x',
    'https://catalog.archives.gov/id/77843341#section-8',
  ];
  const claims: readonly ReleaseClaimProjection[] = hrefs.map((href, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'catalog.archives.gov',
    citationHref: href,
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'minimal');
});

/** Same publisher, different documents — the NRHP nomination form alongside the index entry.
 *  That is real research and counts, which is why this grades documents, not publishers. */
test('computeReleaseResearchCoverage: two documents from one publisher is partial', () => {
  const claims: readonly ReleaseClaimProjection[] = [
    {
      id: 'c1',
      predicate: 'listing',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: 'npgallery.nps.gov',
      citationHref: 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/12000300_text',
      citationLabel: 'L',
    },
    {
      id: 'c2',
      predicate: 'built',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: 'npgallery.nps.gov',
      citationHref: 'https://npgallery.nps.gov/NRHP/AssetDetail?assetID=12000300',
      citationLabel: 'L',
    },
  ];
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'partial');
});

test('computeReleaseResearchCoverage: five+ fully-cited claims across two documents is substantial', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 5 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'S',
    citationHref: `https://example.org/doc-${i % 2}`,
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'substantial');
});

/**
 * repo-vymq. The claim set here is the SAME one that scores 'substantial' directly above — five
 * fully-cited claims across two documents. Only the summary differs. A record whose description
 * was assembled from index fields cannot publish above 'minimal' no matter how its claims score,
 * because coverage is a statement about the prose a reader actually sees.
 */
test('computeReleaseResearchCoverage: a templated summary caps coverage at minimal', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 5 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'S',
    citationHref: `https://example.org/doc-${i % 2}`,
    citationLabel: 'L',
  }));
  const templated = `The Mount Zion Missionary Baptist Church is a historic site.${NRHP_SUMMARY_TRAILER}`;
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'substantial');
  assert.equal(computeReleaseResearchCoverage(claims, templated), 'minimal');
});

/** The filler sentence is a fingerprint in its own right, not only the trailer. */
test('computeReleaseResearchCoverage: the filler sentence also caps coverage', () => {
  const claims: readonly ReleaseClaimProjection[] = [0, 1].map((i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'S',
    citationHref: `https://example.org/doc-${i}`,
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'partial');
  assert.equal(
    computeReleaseResearchCoverage(claims, `A historic site.${NRHP_SUMMARY_FILLER}`),
    'minimal',
  );
});

/** The cap follows the entity through the builder, not just the bare coverage function. */
test('buildReleaseEntityArtifacts publishes a templated summary as minimal coverage', () => {
  const entry = baseEntry({
    summary: `The Lincoln School is a historic site in Alabama.${NRHP_SUMMARY_TRAILER}`,
    claims: [
      {
        predicate: 'listed',
        object: 'Listed on the National Register in 1979.',
        confidenceLevel: 'high',
        citationSource: 'npgallery.nps.gov',
        citationHref: 'https://npgallery.nps.gov/GetAsset/1',
        citationLabel: 'NRHP nomination',
      },
      {
        predicate: 'documented by',
        object: 'A 1979 survey of Black schools in the county.',
        confidenceLevel: 'high',
        citationSource: 'example.org',
        citationHref: 'https://example.org/survey',
        citationLabel: 'County survey',
      },
    ],
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.projection.researchCoverage, 'minimal');
  assert.equal(result.ok && result.searchIndex.researchCoverage, 'minimal');
});

/** Claim volume alone never reaches 'substantial' — the document floor binds first. */
test('computeReleaseResearchCoverage: five+ claims on one document stays minimal', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 6 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'S',
    citationHref: 'https://example.org/only-doc',
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'minimal');
});

test('computeReleaseResearchCoverage: five claims with one uncited stays partial, not substantial', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 5 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: i === 4 ? '' : 'S',
    citationHref: i === 4 ? undefined : `https://example.org/doc-${i % 2}`,
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'partial');
});

/** An uncited claim contributes no document — it must not be counted as its own source. */
test('computeReleaseResearchCoverage: uncited claims contribute no coverage', () => {
  const claims: readonly ReleaseClaimProjection[] = [
    {
      id: 'c1',
      predicate: 'p',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: 'https://example.org/doc-a',
      citationHref: 'https://example.org/doc-a',
      citationLabel: 'L',
    },
    {
      id: 'c2',
      predicate: 'p',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: '',
      citationLabel: 'L',
    },
    {
      id: 'c3',
      predicate: 'p',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: '   ',
      citationLabel: 'L',
    },
  ];
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'minimal');
});

test('resolveReleaseEntityReferences fails closed on an unresolved topicId', () => {
  const entry = baseEntry({ topicIds: ['not-a-real-topic'] });
  const claims: readonly ReleaseClaimProjection[] = [];
  const result = resolveReleaseEntityReferences(entry, claims, []);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /topicIds/);
});

test('resolveReleaseEntityReferences fails closed on a dangling notabilityBasis evidenceId', () => {
  const entry = baseEntry();
  const claims: readonly ReleaseClaimProjection[] = [
    {
      id: 'claim_real',
      predicate: 'p',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: 'S',
      citationLabel: 'L',
    },
  ];
  const result = resolveReleaseEntityReferences(entry, claims, [
    { criterion: 'documented_site', note: 'note', evidenceIds: ['claim_does_not_exist'] },
  ]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /evidenceIds/);
});

test('resolveReleaseEntityReferences fails closed on an empty jurisdictionLabel', () => {
  const entry = baseEntry({ jurisdictionLabel: '   ' });
  const result = resolveReleaseEntityReferences(entry, [], []);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /jurisdiction/);
});

// repo-wqcn / docs/security/location-precision-standard.md: location precision is no longer a
// publish-time REJECTION gate for `resolveReleaseEntityReferences` — a prohibited raw level, a
// living person's own residence, etc. all still reach publish; `buildReleaseEntityArtifacts`
// COARSENS them via `reducePublicPrecision` instead (see the tests on that function below).
test('resolveReleaseEntityReferences allows any non-empty precision level on any kind', () => {
  for (const precision of [
    'street_address',
    'unit',
    'parcel',
    'exact_coordinates',
    'residence',
    'institution',
    'campus',
    'address',
    'site',
  ]) {
    for (const kind of ['place', 'person'] as const) {
      const entry = baseEntry({ kind, locationPrecision: precision, livingStatus: 'unknown' });
      const result = resolveReleaseEntityReferences(entry, [], []);
      assert.equal(result.ok, true, `expected "${precision}" (kind=${kind}) to resolve`);
    }
  }
});

test('buildReleaseEntityArtifacts coarsens a living person\'s "address" precision to city, with reason', () => {
  for (const livingStatus of ['living', 'unknown'] as const) {
    const entry = baseEntry({ kind: 'person', locationPrecision: 'address', livingStatus });
    const result = buildReleaseEntityArtifacts(entry, CONTEXT);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.projection.location.precision, 'city');
    // The point is coarsened with the tier: city publishes two decimals, never the rooftop.
    assert.equal(result.projection.location.lat, Number(result.projection.location.lat.toFixed(2)));
    assert.equal(result.projection.location.lng, Number(result.projection.location.lng.toFixed(2)));
    assert.ok(result.projection.location.geohash.length <= 4);
    assert.equal(
      result.projection.location.precisionReductionReason,
      livingStatus === 'living' ? 'living_residence' : 'living_status_unknown',
    );
  }
});

test('buildReleaseEntityArtifacts publishes "address" precision unreduced for a confirmed-deceased person', () => {
  const entry = baseEntry({
    kind: 'person',
    locationPrecision: 'address',
    livingStatus: 'deceased',
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.location.precision, 'address');
  assert.equal(result.projection.location.precisionReductionReason, undefined);
});

test('buildReleaseEntityArtifacts publishes "address" precision unreduced for a non-person entity', () => {
  const entry = baseEntry({ kind: 'place', locationPrecision: 'address' });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.location.precision, 'address');
});

test('buildReleaseEntityArtifacts coarsens a raw prohibited precision level to city, with reason', () => {
  for (const precision of ['unit', 'parcel', 'residence']) {
    const entry = baseEntry({
      kind: 'place',
      locationPrecision: precision,
      livingStatus: 'deceased',
    });
    const result = buildReleaseEntityArtifacts(entry, CONTEXT);
    assert.equal(result.ok, true, `precision="${precision}"`);
    if (!result.ok) return;
    assert.equal(result.projection.location.precision, 'city', `precision="${precision}"`);
    assert.equal(
      result.projection.location.precisionReductionReason,
      'prohibited_location_precision',
      `precision="${precision}"`,
    );
  }
});

test('buildReleaseEntityArtifacts produces a full projection + search doc for a valid entry', () => {
  const entry = baseEntry();
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.id, entry.id);
  assert.equal(result.projection.releaseId, CONTEXT.releaseId);
  assert.equal(result.projection.generatedAt, CONTEXT.generatedAt);
  assert.equal(result.projection.recordUpdatedAt, CONTEXT.generatedAt);
  assert.equal(result.projection.notabilityBasis.length, 1);
  assert.ok(result.projection.notabilityBasis[0]!.evidenceIds.length > 0);
  assert.equal(result.projection.researchCoverage, 'minimal');
  assert.equal(result.searchIndex.claimCount, 1);
  // The index carries the grading INPUTS, never a grade: one claim is one lineage, and what a
  // reader does with that is `confidenceTierFromEvidenceInputs`'s business, not this package's.
  assert.deepEqual(result.searchIndex.evidenceInputs, {
    strongestClaimLevel: 'high',
    citedLineageKeys: ['example source'],
    evidenceLineageKeys: ['example source'],
  });
  assert.deepEqual(result.searchIndex.notabilityBasis, result.projection.notabilityBasis);
  assert.equal(result.searchIndex.researchCoverage, result.projection.researchCoverage);
});

test('buildReleaseEntityArtifacts caps an uncorroborated record below its strongest claim', () => {
  const entry = baseEntry({
    claims: [
      {
        predicate: 'founded',
        object: '1870',
        confidenceLevel: 'medium',
        citationSource: 'src_example',
        citationLabel: 'Example',
      },
      {
        predicate: 'located_in',
        object: 'Washington, D.C.',
        confidenceLevel: 'low',
        citationSource: 'src_example',
        citationLabel: 'Example',
      },
    ],
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Both claims cite src_example: one lineage, recorded once. The step-down that follows from
  // it is the read-time rule's, and is asserted in `@repo/public-contracts`' evidence suite.
  assert.deepEqual(result.searchIndex.evidenceInputs, {
    strongestClaimLevel: 'medium',
    citedLineageKeys: ['src_example'],
    evidenceLineageKeys: ['src_example'],
  });
  assert.equal(result.searchIndex.claimCount, 2);
});

test('buildReleaseEntityArtifacts publishes the top tier once a second lineage corroborates', () => {
  const entry = baseEntry({
    claims: [
      {
        predicate: 'founded',
        object: '1870',
        confidenceLevel: 'high',
        citationSource: 'npgallery.nps.gov',
        citationLabel: 'National Register nomination',
      },
      {
        predicate: 'located_in',
        object: 'Washington, D.C.',
        confidenceLevel: 'high',
        citationSource: 'catalog.archives.gov',
        citationLabel: 'National Archives',
      },
    ],
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.searchIndex.evidenceInputs, {
    strongestClaimLevel: 'high',
    citedLineageKeys: ['npgallery.nps.gov', 'catalog.archives.gov'],
    evidenceLineageKeys: ['npgallery.nps.gov', 'catalog.archives.gov'],
  });
});

test('recordEvidenceInputs collapses one publisher spelled several ways to one lineage', () => {
  // This package projects grading inputs and never grades. What the rule then makes of these
  // inputs is asserted in `@repo/public-contracts/src/evidence.test.ts`, and that the two
  // projections agree is asserted in `apps/web/src/lib/evidence/confidence-rule-parity.test.ts`.
  assert.deepEqual(
    recordEvidenceInputs([
      { confidenceLevel: 'high', citationSource: 'wikipedia_api' },
      { confidenceLevel: 'high', citationSource: 'en.wikipedia.org' },
    ]),
    {
      strongestClaimLevel: 'high',
      citedLineageKeys: ['wikipedia'],
      evidenceLineageKeys: ['wikipedia'],
    },
  );
  assert.deepEqual(
    recordEvidenceInputs([
      { confidenceLevel: 'high', citationSource: 'www.nps.gov' },
      { confidenceLevel: 'high', citationSource: 'nps.gov' },
    ]),
    {
      strongestClaimLevel: 'high',
      citedLineageKeys: ['nps.gov'],
      evidenceLineageKeys: ['nps.gov'],
    },
  );
  // No claims, and a claim with no citation: an empty lineage list either way, which is what
  // lets the rule tell "nobody assessed this" apart from "assessed and poorly supported".
  assert.deepEqual(recordEvidenceInputs([]), {
    strongestClaimLevel: 'unrated',
    citedLineageKeys: [],
    evidenceLineageKeys: [],
  });
  assert.deepEqual(recordEvidenceInputs([{ confidenceLevel: 'high' }]), {
    strongestClaimLevel: 'high',
    citedLineageKeys: [],
    evidenceLineageKeys: [],
  });
});

test("recordEvidenceInputs keeps the record's own index row out of the evidence lineages", () => {
  // Wikipedia stays in BOTH lists on purpose. It carries a claim and never corroborates one
  // (repo-goyut), but that is a policy about one publisher and policy is the rule's, so the
  // projection records it and `confidenceTierFromEvidenceInputs` discounts it.
  assert.deepEqual(
    recordEvidenceInputs([
      { confidenceLevel: 'high', citationSource: 'npgallery.nps.gov' },
      { confidenceLevel: 'medium', citationSource: 'en.wikipedia.org' },
    ]),
    {
      strongestClaimLevel: 'high',
      citedLineageKeys: ['npgallery.nps.gov', 'wikipedia'],
      evidenceLineageKeys: ['npgallery.nps.gov', 'wikipedia'],
    },
  );
  // nrhp-black-heritage-00000006: the listing claims are the NARA row the record was seeded
  // from, so the nomination form is the only document evidencing anything (repo-6jizv). Every
  // claim states its role explicitly, matching what the publisher writes post-migration.
  assert.deepEqual(
    recordEvidenceInputs([
      {
        confidenceLevel: 'high',
        claimRole: 'record_index',
        citationSource: 'catalog.archives.gov',
      },
      {
        confidenceLevel: 'high',
        claimRole: 'record_index',
        citationSource: 'catalog.archives.gov',
      },
      {
        confidenceLevel: 'high',
        claimRole: 'evidence',
        citationSource: 'npgallery.nps.gov',
      },
    ]),
    {
      strongestClaimLevel: 'high',
      citedLineageKeys: ['catalog.archives.gov', 'npgallery.nps.gov'],
      evidenceLineageKeys: ['npgallery.nps.gov'],
    },
  );
  // Two documents read, neither the index row.
  assert.deepEqual(
    recordEvidenceInputs([
      {
        confidenceLevel: 'high',
        claimRole: 'record_index',
        citationSource: 'catalog.archives.gov',
      },
      {
        confidenceLevel: 'high',
        claimRole: 'evidence',
        citationSource: 'npgallery.nps.gov',
      },
      {
        confidenceLevel: 'high',
        claimRole: 'evidence',
        citationSource: 'blackpast.org',
      },
    ]),
    {
      strongestClaimLevel: 'high',
      citedLineageKeys: ['catalog.archives.gov', 'npgallery.nps.gov', 'blackpast.org'],
      evidenceLineageKeys: ['npgallery.nps.gov', 'blackpast.org'],
    },
  );
  // A lineage cited by both an index-row claim and an evidence claim is still evidence: the
  // partition is per lineage, not per claim.
  assert.deepEqual(
    recordEvidenceInputs([
      {
        confidenceLevel: 'high',
        claimRole: 'record_index',
        citationSource: 'catalog.archives.gov',
      },
      {
        confidenceLevel: 'high',
        claimRole: 'evidence',
        citationSource: 'catalog.archives.gov',
      },
    ]),
    {
      strongestClaimLevel: 'high',
      citedLineageKeys: ['catalog.archives.gov'],
      evidenceLineageKeys: ['catalog.archives.gov'],
    },
  );
});

test('recordEvidenceInputs treats a claim missing claimRole as evidence, never inferred from its predicate', () => {
  // The predicate bridge is gone: every published claim now carries `claimRole`, so a claim
  // without it is not read as the record's own index row just because its predicate used to
  // describe one under the old bridge vocabulary. It counts as evidence like any other claim —
  // the explicit default the current schema demands, not an inference.
  assert.deepEqual(
    recordEvidenceInputs([
      { confidenceLevel: 'high', predicate: 'listing', citationSource: 'catalog.archives.gov' },
      {
        confidenceLevel: 'high',
        predicate: 'significant for',
        citationSource: 'catalog.archives.gov',
      },
      {
        confidenceLevel: 'high',
        predicate: 'source states',
        citationSource: 'npgallery.nps.gov',
      },
    ]),
    {
      strongestClaimLevel: 'high',
      citedLineageKeys: ['catalog.archives.gov', 'npgallery.nps.gov'],
      evidenceLineageKeys: ['catalog.archives.gov', 'npgallery.nps.gov'],
    },
  );
  // Stating the role explicitly still excludes the index row, and a predicate outside the old
  // bridge vocabulary is no obstacle to being named the index row.
  assert.deepEqual(
    recordEvidenceInputs([
      {
        confidenceLevel: 'high',
        predicate: 'source states',
        claimRole: 'record_index',
        citationSource: 'catalog.archives.gov',
      },
      {
        confidenceLevel: 'high',
        predicate: 'source states',
        claimRole: 'evidence',
        citationSource: 'npgallery.nps.gov',
      },
    ]),
    {
      strongestClaimLevel: 'high',
      citedLineageKeys: ['catalog.archives.gov', 'npgallery.nps.gov'],
      evidenceLineageKeys: ['npgallery.nps.gov'],
    },
  );
});

test('buildReleaseEntityArtifacts: every published location precision is a controlled public tier', () => {
  const rawPrecisions = [
    'site',
    'county',
    'city',
    'institution',
    'campus',
    'address',
    'neighborhood',
    'community',
    'town',
    'district',
    'cemetery',
    'state',
    'block',
    'building',
    'park',
    'country',
    'garrison',
    'region',
    'territory',
    'stadium',
    'unit',
    'parcel',
    'exact_coordinates',
    'residence',
    'street_address',
    'totally-unrecognized-value',
  ];
  for (const precision of rawPrecisions) {
    const entry = baseEntry({
      kind: 'place',
      locationPrecision: precision,
      livingStatus: 'deceased',
    });
    const result = buildReleaseEntityArtifacts(entry, CONTEXT);
    assert.equal(result.ok, true, `precision="${precision}"`);
    if (!result.ok) continue;
    assert.equal(
      PUBLIC_PRECISION_TIERS.includes(
        result.projection.location.precision as (typeof PUBLIC_PRECISION_TIERS)[number],
      ),
      true,
      `precision="${precision}" -> "${result.projection.location.precision}" not a controlled tier`,
    );
  }
});

test('buildReleaseEntityArtifacts fails closed with no_citations when an entry has zero claims', () => {
  const entry = baseEntry({ claims: [] });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'no_citations');
});

test('buildReleaseEntityArtifacts fails closed when an admin flagged the entity for retraction', () => {
  const entry = baseEntry();
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    catalogDecision: { action: 'flag_for_retraction', reason: 'Owner-confirmed factual error' },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'catalog_decision_retracted');
  assert.match(result.message, /Owner-confirmed factual error/);
});

test('buildReleaseEntityArtifacts ignores a needs_review or clear_flag catalog decision', () => {
  const entry = baseEntry();
  for (const action of ['needs_review', 'clear_flag'] as const) {
    const result = buildReleaseEntityArtifacts(entry, {
      ...CONTEXT,
      catalogDecision: { action, reason: 'just a note' },
    });
    assert.equal(result.ok, true, `expected ${action} to still build`);
  }
});

test('buildReleaseEntityArtifacts fails closed when every claim lacks a citationSource', () => {
  const entry = baseEntry({
    claims: [
      {
        predicate: 'founded_year',
        object: '1900',
        confidenceLevel: 'high',
        citationSource: '   ',
        citationLabel: 'Citation A',
      },
    ],
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'notability_basis_gate');
});

test('buildReleaseEntityArtifacts fails closed on an unresolvable topicId', () => {
  const entry = baseEntry({ topicIds: ['definitely-not-real'] });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'reference_resolution');
});

test('buildReleaseEntityArtifacts throws on an out-of-range coordinate', () => {
  const entry = baseEntry({ lat: 200 });
  assert.throws(() => buildReleaseEntityArtifacts(entry, CONTEXT), /lat out of range/);
});

test('buildReleaseEntityArtifacts is deterministic across repeated calls', () => {
  const entry = baseEntry();
  const first = buildReleaseEntityArtifacts(entry, CONTEXT);
  const second = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.deepEqual(first, second);
});

test('buildReleaseEntityArtifacts prefers locationOverride over catalog lat/lng', () => {
  const entry = baseEntry({ lat: 33.749, lng: -84.388 });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    locationOverride: {
      lat: 33.7554,
      lng: -84.376,
      precision: 'neighborhood',
      matchMethod: 'geocode_census',
      locationLabel: 'Sweet Auburn, Atlanta',
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.location.lat, 33.7554);
  assert.equal(result.projection.location.lng, -84.376);
  assert.equal(result.projection.location.precision, 'neighborhood');
  assert.equal(result.projection.location.matchMethod, 'geocode_census');
  assert.equal(result.projection.locationLabel, 'Sweet Auburn, Atlanta');
});

test('buildReleaseEntityArtifacts prefers context.relatedEntries over entry.related bootstrap', () => {
  const entry = baseEntry({
    related: [{ id: 'ent_bootstrap_001', type: 'related_to', direction: 'outgoing' }],
  });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    relatedEntries: [{ id: 'ent_graph_001', type: 'located_at', direction: 'outgoing' }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.projection.related, [
    { id: 'ent_graph_001', type: 'located_at', direction: 'outgoing' },
  ]);
  assert.equal(result.searchIndex.relatedCount, 1);
});

test('buildReleaseEntityArtifacts falls back to entry.related when context has no relatedEntries', () => {
  const entry = baseEntry({
    related: [{ id: 'ent_arrest_site_001', type: 'located_at', direction: 'outgoing' }],
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.projection.related, [
    { id: 'ent_arrest_site_001', type: 'located_at', direction: 'outgoing' },
  ]);
  assert.equal(result.searchIndex.relatedCount, 1);
});

test('buildReleaseEntityArtifacts omits related and keeps relatedCount 0 when none provided', () => {
  const entry = baseEntry();
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.related, undefined);
  assert.equal(result.searchIndex.relatedCount, 0);
});

test('buildReleaseEntityArtifacts sanitizes prose links in search index and claim objects', () => {
  const entry = baseEntry({
    summary: 'The U.S. [[gap_supreme_court|Supreme Court]], established in 1789.',
    claims: [
      {
        predicate: 'established',
        object: 'The [[gap_supreme_court|Supreme Court]] began operations in 1789.',
        confidenceLevel: 'high',
        citationSource: 'Example Source',
        citationLabel: 'Example Citation',
      },
    ],
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.searchIndex.summary, 'The U.S. Supreme Court, established in 1789.');
  assert.equal(
    result.projection.summary,
    'The U.S. [[gap_supreme_court|Supreme Court]], established in 1789.',
  );
  assert.equal(result.projection.claims[0]?.object, 'The Supreme Court began operations in 1789.');
  assert.equal(sanitizePublicProseText('[[gap_supreme_court|Supreme Court]]'), 'Supreme Court');
});

test('buildReleaseEntityArtifacts derives status when entry has no status field', () => {
  const entry = baseEntry({
    summary:
      'Howard University remains a working research university in Washington, D.C., with an active campus.',
    eraBuckets: ['1860s'],
  });
  assert.equal(entry.status, undefined);
  assert.equal(entry.statusHistory, undefined);

  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.status, 'active');
  assert.equal(result.searchIndex.status, 'active');
  assert.ok(result.projection.statusHistory);
  assert.equal(result.projection.statusHistory?.[0]?.status, 'active');
  assert.equal(result.projection.statusHistory?.[0]?.validFrom, '1860');
  assert.equal(result.projection.statusProvenance, 'derived_heuristic');
});

test('canonical living_status deceased wins over source hints that would imply living', () => {
  const entry = baseEntry({
    kind: 'person',
    summary: 'A'.repeat(130),
    livingStatus: 'living',
  });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    canonicalStatus: { livingStatus: 'deceased' },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.livingStatus, 'deceased');
  assert.equal(result.projection.status, 'deceased');
  assert.equal(result.projection.statusProvenance, 'canonical');
  assert.equal(result.searchIndex.status, 'deceased');
});

test('canonical status_history uses currentStatus for multi-entry histories', () => {
  const entry = baseEntry({
    kind: 'law',
    summary:
      'The Civil Rights Act of 1964 outlawed discrimination based on race, color, religion, sex, and national origin in public accommodations and employment nationwide.',
  });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    canonicalStatus: {
      statusHistory: [
        {
          status: 'in_force',
          validFrom: '1964',
          validTo: '2020',
          datePrecision: 'year',
          basisClaimIds: [],
        },
        {
          status: 'repealed',
          validFrom: '2020',
          datePrecision: 'year',
          basisClaimIds: [],
        },
      ],
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.status, 'repealed');
  assert.equal(result.projection.statusProvenance, 'canonical');
});

test('person projection carries livingStatus and statusProvenance from heuristic backstop', () => {
  const entry = baseEntry({
    kind: 'person',
    summary:
      'A'.repeat(120) +
      ' She died in 1972 after decades of community leadership in Atlanta, Georgia.',
    livingStatus: 'deceased',
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.livingStatus, 'deceased');
  assert.equal(result.projection.status, 'deceased');
  assert.equal(result.projection.statusProvenance, 'derived_heuristic');
});

test('buildReleaseEntityArtifacts emits projection.visit gated through publicVisitForTier', () => {
  const entry = baseEntry({
    kind: 'place',
    locationPrecision: 'address',
    visit: {
      address: {
        street: '1530 6th Avenue North',
        city: 'Birmingham',
        state: 'AL',
        line: '1530 6th Avenue North, Birmingham, AL',
      },
      phone: { e164: '+12053281000', display: '(205) 328-1000' },
      website: 'https://example.org',
      hours: 'Tue–Sat 10am–5pm',
      visitability: 'open_to_public',
      sources: ['claim-visit-1'],
    },
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.visit?.address?.street, '1530 6th Avenue North');
  assert.equal(result.projection.visit?.phone?.e164, '+12053281000');
  assert.equal(result.projection.visit?.website, 'https://example.org');
  assert.deepEqual(result.projection.visit?.sources, ['claim-visit-1']);
});

test('buildReleaseEntityArtifacts omits street/line from projection.visit at coarser precision', () => {
  const entry = baseEntry({
    kind: 'place',
    locationPrecision: 'institution',
    visit: {
      address: { street: '1530 6th Avenue North', city: 'Birmingham' },
      visitability: 'open_to_public',
    },
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.visit?.address?.street, undefined);
  assert.equal(result.projection.visit?.address?.city, 'Birmingham');
});

test('buildReleaseEntityArtifacts omits phone/website from projection.visit when livingStatus is living', () => {
  // Institution kind avoids the person-only precision-ceiling gate in
  // resolveReleaseEntityReferences, isolating the phone/website living-status gate under test.
  const entry = baseEntry({
    kind: 'institution',
    locationPrecision: 'address',
    livingStatus: 'living',
    visit: {
      phone: { e164: '+12055551234', display: '(205) 555-1234' },
      website: 'https://example.org',
      visitability: 'open_to_public',
    },
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.visit?.phone, undefined);
  assert.equal(result.projection.visit?.website, undefined);
});

test('buildReleaseEntityArtifacts context.visitOverride wins over entry.visit', () => {
  const entry = baseEntry({
    kind: 'place',
    locationPrecision: 'address',
    visit: {
      address: { street: 'Entry Street' },
      visitability: 'open_to_public',
    },
  });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    visitOverride: {
      address: { street: 'Canonical Street' },
      visitability: 'open_to_public',
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.visit?.address?.street, 'Canonical Street');
});

test('buildReleaseEntityArtifacts omits projection.visit entirely when nothing survives gating', () => {
  const entry = baseEntry({
    kind: 'place',
    locationPrecision: 'institution',
    visit: { address: { street: 'Only A Street' } },
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.visit, undefined);
});

/*
 * repo-oyxgh. Ell Persons's real claim set from the active release, verbatim. `isKillingPredicate`
 * is the police-killing cohort's vocabulary (killed | shot | died | victim of) and matches NONE of
 * these, so M1's "does this record state its killing" test was false and the filter fell through
 * to keeping every claim — which promoted what was done to him on the way to his murder into this
 * catalog's stated reasons for naming him.
 *
 * Measured on the active release 2026-09-12: 20 of the 32 `lynching_*` records were in this state.
 */
const ellPersonsClaims = [
  {
    predicate: 'was lynched',
    object: 'on May 22, 1917, in Memphis, Tennessee',
    confidenceLevel: 'high' as const,
    citationSource: 'https://lynchinginamerica.eji.org/',
    citationLabel: 'Lynching in America',
  },
  {
    predicate: 'was accused of',
    object: 'raping and murdering 15-year-old Antoinette Rappel',
    confidenceLevel: 'high' as const,
    citationSource: 'https://example.org/accusation',
    citationLabel: 'Contemporary press',
  },
  {
    predicate: 'was subjected to',
    object: 'brutal interrogation leading to a forced confession',
    confidenceLevel: 'high' as const,
    citationSource: 'https://example.org/interrogation',
    citationLabel: 'Historical account',
  },
  {
    predicate: 'was captured by',
    object: 'a lynch mob while in transit to stand trial',
    confidenceLevel: 'high' as const,
    citationSource: 'https://example.org/capture',
    citationLabel: 'Historical account',
  },
  {
    predicate: 'was burned alive and dismembered',
    object: 'in a public spectacle attended by a large crowd',
    confidenceLevel: 'high' as const,
    citationSource: 'https://example.org/spectacle',
    citationLabel: 'Historical account',
  },
  {
    predicate: 'was followed by',
    object:
      'the NAACP investigation of his lynching by field secretary James Weldon Johnson and the ' +
      'chartering of the Memphis branch',
    confidenceLevel: 'high' as const,
    citationSource: 'https://example.org/naacp',
    citationLabel: 'NAACP records',
  },
];

test('a lynching record does not publish its own capture and interrogation as reasons it is in the catalog', () => {
  const entry = baseEntry({
    id: 'lynching_ell_persons_memphis_tennessee',
    kind: 'person',
    displayName: 'Ell Persons',
    summary:
      'Ell Persons was lynched near Memphis, Tennessee on May 22, 1917, burned alive before a ' +
      'crowd of thousands after being taken from custody while in transit to stand trial.',
    claims: ellPersonsClaims,
  });
  const basis = buildReleaseNotabilityBasis(entry);
  const notes = basis.map((record) => record.note);

  assert.ok(
    !notes.some((note) => /subjected to/iu.test(note)),
    `"was subjected to" must not be an inclusion reason — got ${JSON.stringify(notes)}`,
  );
  assert.ok(
    !notes.some((note) => /captured by/iu.test(note)),
    `"was captured by" must not be an inclusion reason — got ${JSON.stringify(notes)}`,
  );
  assert.ok(
    !notes.some((note) => /accused of/iu.test(note)),
    'the mob’s own pretext is never why this catalog names someone',
  );

  // What SHOULD survive: the killing itself, stated in the record's own vocabulary.
  assert.ok(
    notes.some((note) => /lynched/iu.test(note)),
    `the lynching itself must remain a reason — got ${JSON.stringify(notes)}`,
  );
  assert.deepEqual(
    basis.map((record) => record.criterion),
    ['documented_racial_terror', 'documented_racial_terror'],
    'the two killing claims, and nothing else',
  );

  /*
   * The published record also carries a `movement_significance` basis for the NAACP investigation
   * that followed (repo-9u3di). A RECOMPUTE does not produce it: `was followed by`
   * infers `documented_site`, so `identifies()` is false for it.
   *
   * That basis comes from `apply-notability-rubric-ruling.ts`'s MERGE, which is why the bead calls
   * the merge safe and a straight recompute (fix-racial-terror-notability-basis.ts,
   * fix-missing-killing-claims.ts) unsafe for this cohort. Asserted here so the next person
   * comparing a recompute against what is live does not read the difference as a regression.
   */
  assert.equal(
    inferNotabilityCriterionFromClaim('was followed by', ellPersonsClaims[5]!.object, 'person'),
    'documented_site',
  );
});

test('the racial-terror killing vocabulary counts as stating the killing', () => {
  for (const predicate of [
    'was lynched',
    'was burned alive and dismembered',
    'was hanged',
    'was beaten to death',
  ]) {
    assert.equal(
      isKillingPredicate(predicate) || isRacialTerrorKillingPredicate(predicate),
      true,
      `${predicate} must count as stating the killing`,
    );
  }
  // Unchanged: the two tests stay separate, and this is why the fix is a union at the M1 filter
  // rather than a widening of either one.
  assert.equal(isKillingPredicate('was lynched'), false);
  assert.equal(isRacialTerrorKillingPredicate('died'), false);
});

/*
 * repo-15slz. Inclusion notes are built by joining a sentence-cased predicate to its claim object.
 * That is right only when the object is the lowercase continuation the format was designed for,
 * and the measurement says that shape is a minority: over rel_20260723_authority_net_001, 5,533 of
 * 12,137 claim objects (45.6%) open lowercase and 6,175 (50.9%) open with a capital. Two defects
 * followed, and both reached the public "why this appears" surface. Shape (a), below, is prose
 * that opens by repeating the predicate's own verb — "Born in Born into slavery on April 5, 1856".
 * Shape (b), further down, is prose that is already a sentence of its own.
 *
 * Every pair below is real, taken from the active release.
 */
test('an object that repeats the predicate verb does not stutter', () => {
  for (const [predicate, object, expected] of [
    [
      'born_in',
      'Born into slavery on April 5, 1856, in Hale’s Ford, Franklin County, Virginia.',
      'Born into slavery on April 5, 1856, in Hale’s Ford, Franklin County, Virginia.',
    ],
    ['renamed', 'Renamed Livingstone College in 1887', 'Renamed Livingstone College in 1887.'],
    [
      'pulitzer_prizes',
      "Pulitzer Prize for Drama for 'Fences' (1987) and 'The Piano Lesson' (1990)",
      "Pulitzer Prize for Drama for 'Fences' (1987) and 'The Piano Lesson' (1990).",
    ],
    [
      'developed_treatment',
      'Developed the Ball Method for injectable chaulmoogra oil',
      'Developed the Ball Method for injectable chaulmoogra oil.',
    ],
    [
      'first_in_nation',
      'First medical school for African Americans in the South',
      'First medical school for African Americans in the South.',
    ],
  ] as const) {
    assert.equal(formatClaimInclusionNote(predicate, object), expected);
  }
});

test('when the predicate is the fuller statement, the stub object is dropped instead', () => {
  // Collapsing toward the object here would throw away the election and the town.
  assert.equal(
    formatClaimInclusionNote(
      'was the third Black man elected as alderman in Annapolis',
      'third Black alderman',
    ),
    'Was the third Black man elected as alderman in Annapolis.',
  );
  assert.equal(
    formatClaimInclusionNote('was born into slavery in North Carolina', 'born into slavery'),
    'Was born into slavery in North Carolina.',
  );
  assert.equal(
    formatClaimInclusionNote('was a rice plantation during the mid-1800s', 'rice plantation'),
    'Was a rice plantation during the mid-1800s.',
  );
});

test('a shared word that is not the predicate verb still joins normally', () => {
  // "American" appears in both. Collapsing this pair would leave the note reading "American
  // League", which is why matching is on the predicate's first meaning-bearing word alone.
  assert.equal(
    formatClaimInclusionNote('was first African American to hit a home run in', 'American League'),
    'Was first African American to hit a home run in American League.',
  );
  assert.equal(
    formatClaimInclusionNote(
      'resettled liberated Africans after 1807',
      'Africans freed by Royal Navy',
    ),
    'Resettled liberated Africans after 1807 Africans freed by Royal Navy.',
  );
});

/*
 * repo-15slz shape (b), the bulk of the defect: the object is not a continuation at all but a
 * sentence of its own, so joining the predicate onto its front leaves a dangling fragment in
 * front of a complete sentence — "First to In 1977, President Carter appointed Young …". Measured
 * over rel_20260723_authority_net_001 on 2026-09-13: 2,365 of the 6,105 published basis records
 * were composed this way. Every pair below is real, taken from that release.
 */
test('a predicate is not joined onto an object that is already a sentence', () => {
  for (const [predicate, object, expected] of [
    [
      'founded_in',
      'Washington and a small group opened the Tuskegee Normal and Industrial School on July 4, 1881, in Tuskegee, Alabama, with no initial buildings or land.',
      'Washington and a small group opened the Tuskegee Normal and Industrial School on July 4, 1881, in Tuskegee, Alabama, with no initial buildings or land.',
    ],
    [
      'first_to',
      'In 1977, President Carter appointed Young U.S. Ambassador to the United Nations, the first African American to hold the post.',
      'In 1977, President Carter appointed Young U.S. Ambassador to the United Nations, the first African American to hold the post.',
    ],
    [
      'elected_on',
      'Young was elected to the U.S. House of Representatives from Georgia in 1972, becoming the first Black congressman from Georgia since Reconstruction.',
      'Young was elected to the U.S. House of Representatives from Georgia in 1972, becoming the first Black congressman from Georgia since Reconstruction.',
    ],
    [
      'organized',
      'SNCC organized 1961 Freedom Rides to test desegregation of interstate travel, launched Southern voter registration campaigns from 1962 onward, and led the 1964 Mississippi Freedom Summer project.',
      'SNCC organized 1961 Freedom Rides to test desegregation of interstate travel, launched Southern voter registration campaigns from 1962 onward, and led the 1964 Mississippi Freedom Summer project.',
    ],
    // The object opens with its own verb rather than a subject. No period ends it, so the
    // trailing-punctuation signal cannot be what catches these two.
    [
      'hall_of_fame_inducted',
      'Inducted into the Rock and Roll Hall of Fame in 2006 in the Performer category',
      'Inducted into the Rock and Roll Hall of Fame in 2006 in the Performer category.',
    ],
    [
      'received_honor_year',
      'Presidential Medal of Freedom, awarded in 2009',
      'Presidential Medal of Freedom, awarded in 2009.',
    ],
  ] as const) {
    assert.equal(formatClaimInclusionNote(predicate, object), expected);
  }
});

test('a capital-initial object that is only a noun phrase keeps its predicate', () => {
  // The other half of shape (b): dropping the predicate here would publish a bare label. These
  // are the shapes the rule must NOT touch, and all six are real pairs from the same release.
  for (const [predicate, object, expected] of [
    [
      'included_in',
      'National Register of Historic Places',
      'Included in National Register of Historic Places.',
    ],
    ['issued_by', 'President John F. Kennedy', 'Issued by President John F. Kennedy.'],
    [
      'significant for',
      'Black heritage, education, and architecture',
      'Significant for Black heritage, education, and architecture.',
    ],
    [
      'forbade',
      'African Americans from visiting the post office or railroad station',
      'Forbade African Americans from visiting the post office or railroad station.',
    ],
    // A trailing period that belongs to an abbreviation is not a sentence ending.
    ['killed', 'Daniel L. Simmons Sr.', 'Killed Daniel L. Simmons Sr.'],
    ['location', 'Washington, D.C.', 'Location Washington, D.C.'],
    // A capital-initial DATE is a continuation of the predicate, not a sentence, even when a
    // clause follows it.
    [
      'decided_on',
      'April 1, 1935, 294 U.S. 587, in an 8-0 decision written by Chief Justice Charles Evans Hughes',
      'Decided on April 1, 1935, 294 U.S. 587, in an 8-0 decision written by Chief Justice Charles Evans Hughes.',
    ],
  ] as const) {
    assert.equal(formatClaimInclusionNote(predicate, object), expected);
  }
});

test('the continuation shape the format was designed for is unchanged', () => {
  assert.equal(formatClaimInclusionNote('founded_year', '1900'), 'Founded year 1900.');
  assert.equal(
    formatClaimInclusionNote('listed_on', 'the National Register of Historic Places'),
    'Listed on the National Register of Historic Places.',
  );
  assert.equal(formatClaimInclusionNote('served_as', ''), 'Served as.');
  assert.equal(
    formatClaimInclusionNote('', 'A bare object stands alone'),
    'A bare object stands alone.',
  );
});
