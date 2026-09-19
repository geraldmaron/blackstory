/**
 * Unit tests for incremental publish gating and row mapping.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessLandscapeDepth,
  buildLiveDepthEntry,
  buildReleaseSourceFromLandscape,
  buildArtifactsForEntry,
  canonicalUpsertParamsFromLandscape,
  carryLiveClaims,
  catalogDecisionFromRow,
  claimCountRegressed,
  liveSourceClaims,
  gateLandscapePublishCandidate,
  incrementalPublishProvenancePatch,
  jurisdictionFromPlace,
  jurisdictionFromProvenance,
  liveLocationFromRow,
  MERGED_EVIDENCE_QUOTE_MAX_CHARS,
  parseCanonicalStatusSnapshot,
  toReleaseEntityRow,
  toSearchIndexRow,
  visitOverrideFromCanonicalRow,
  type CanonicalVisitRow,
  type CatalogDecisionRow,
  type LandscapePublishRow,
  type PublishCatalogDecision,
  type LiveLocationInheritance,
} from './incremental-publish.ts';
import {
  buildReleaseEntityArtifacts,
  deriveCatalogEntityStatus,
  type PublicVisit,
} from '@repo/domain';
import { mapPostgresSearchIndexRow } from '@repo/schemas';
import { divergentFieldsForRow, expectedSearchTopics } from './projection-divergence.ts';

import type { ReviewedClaimAssessment } from './confidence.ts';

/** Other gate tests supply independent ledger fixtures so they isolate their stated rule. */
function reviewedClaimsFor(row: LandscapePublishRow, score = 0.9): ReviewedClaimAssessment[] {
  const entry = buildReleaseSourceFromLandscape(row);
  return (entry?.claims ?? []).map((claim, index) => ({
    entityId: entry!.id,
    claimId: claim.id ?? `reviewed-claim-${index}`,
    claimVersionId: `version-${index}`,
    predicate: claim.predicate,
    object: claim.object,
    citationHrefs: claim.citationHref ? [claim.citationHref] : [],
    reviewedEvidenceCaptures: claim.citationHref
      ? [
          {
            sourceUrl: claim.citationHref,
            sourceItemId: `source-item-${index}`,
            captureId: `capture-${index}`,
            contentHashDigest: index.toString(16).padStart(64, '0'),
          },
        ]
      : [],
    assessmentId: `assessment-${index}`,
    reviewDecisionId: `review-${index}`,
    assessment: {
      acceptanceProbability: score,
      intervalLow: score,
      intervalHigh: 1,
      sourceReliability: score,
      entailment: score,
      independence: score,
      identityConfidence: score,
      relevance: 1,
      researchCompleteness: score,
      calibrationVersion: 'test-held-out-v1',
    },
  }));
}

function gateWithReviewedClaims(input: Parameters<typeof gateLandscapePublishCandidate>[0]) {
  return gateLandscapePublishCandidate({
    ...input,
    reviewedClaims: reviewedClaimsFor({
      ...input.row,
      lat: input.row.lat ?? input.liveLocation?.lat ?? null,
      lng: input.row.lng ?? input.liveLocation?.lng ?? null,
    }),
  });
}

/** Parsed host, or null for anything unparseable — never a substring test on the raw URL. */
const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

const baseRow = (overrides: Partial<LandscapePublishRow> = {}): LandscapePublishRow => ({
  id: 'dc-black-history-sites-b10',
  lane: 'dc-sites',
  kind: 'place',
  display_name: 'Gardner Bishop Barber Shop',
  summary:
    'Business site at 1900 15th Street NW in Washington, DC (1940), documented in the DC Historic Preservation Office inventory. ' +
    'The site records a locally significant commercial setting associated with the Black community, ' +
    'with source material preserved through the historic-preservation inventory. The inventory entry ' +
    'notes the shop operated continuously through the mid-twentieth century, serving the surrounding ' +
    'Shaw neighborhood, and remained a fixture of the commercial corridor until the property changed ' +
    'hands in the following decades, per the same preservation-office record.',
  lat: 38.915775,
  lng: -77.034763,
  canonical_url: 'https://historicsites.dcpreservation.org/items/show/1055',
  source_item_id: 'b10',
  provenance: {
    sourceCategory: 'Business',
    historicAddress: '1900 15th Street NW',
    sourceCity: 'Washington',
    sourceState: 'DC',
  },
  payload: {},
  exact_in_release: false,
  name_overlap: false,
  ...overrides,
});

/**
 * The same DC row after an evidence sweep has written its history back onto the landscape row.
 * Tests that only need a publishable entry use this, not `baseRow()` — the bare inventory row is
 * held back by the depth gate by design.
 */
const enrichedRow = (overrides: Partial<LandscapePublishRow> = {}): LandscapePublishRow =>
  baseRow({
    payload: {
      historicalContext:
        'Gardner Bishop, a barber with no formal legal training, organized the Consolidated ' +
        'Parent Group out of this shop and drove the school-desegregation suit that became ' +
        'Bolling v. Sharpe, decided the same day as Brown.',
    },
    ...overrides,
  });

/** An invention-cohort landscape row, for the grant-date statusHistory tests below. */
const inventionRow = (overrides: Partial<LandscapePublishRow> = {}): LandscapePublishRow => ({
  id: 'inv_example_device',
  lane: 'invention-cohort',
  kind: 'invention',
  display_name: 'Example Device',
  summary:
    'US 1,475,024, titled "Example Device," names A. Example and was granted on 20 November 1923. '.repeat(
      4,
    ),
  lat: 41.4993,
  lng: -81.6944,
  canonical_url: 'https://patents.google.com/patent/US1475024A',
  source_item_id: 'inv_example_device',
  provenance: {},
  payload: { eraBuckets: ['1920s'] },
  exact_in_release: false,
  name_overlap: false,
  ...overrides,
});

test('jurisdictionFromProvenance maps DC to full label', () => {
  assert.equal(
    jurisdictionFromProvenance({ sourceCity: 'Washington', sourceState: 'DC' }),
    'Washington, District of Columbia',
  );
});

test('jurisdictionFromPlace uses NRHP payload city and state, not country fallback', () => {
  assert.equal(
    jurisdictionFromPlace({
      city: 'St. Louis (Independent City)',
      state: 'Missouri',
      lat: 38.637,
      lng: -90.216,
    }),
    'St. Louis, Missouri',
  );
});

test('jurisdictionFromPlace expands postal codes and falls back to the pin state', () => {
  assert.equal(jurisdictionFromPlace({ city: 'Selma', state: 'AL' }), 'Selma, Alabama');
  assert.equal(jurisdictionFromPlace({ lat: 42.6526, lng: -73.7562 }), 'New York');
});

test('buildReleaseSourceFromLandscape reads city/state off NRHP payload', () => {
  const entry = buildReleaseSourceFromLandscape(
    baseRow({
      id: 'nrhp-black-heritage-76002235',
      lane: 'nrhp-black-heritage',
      display_name: 'Joplin, Scott, House',
      lat: 38.637,
      lng: -90.216,
      provenance: { refnum: '76002235' },
      payload: {
        city: 'St. Louis (Independent City)',
        state: 'Missouri',
      },
    }),
  );
  assert.ok(entry);
  assert.equal(entry.jurisdictionLabel, 'St. Louis, Missouri');
});

test('buildReleaseSourceFromLandscape produces claims from canonical_url', () => {
  const entry = buildReleaseSourceFromLandscape(baseRow());
  assert.ok(entry);
  assert.equal(entry?.claims?.length, 1);
  assert.equal(
    entry?.claims?.[0]?.citationHref,
    'https://historicsites.dcpreservation.org/items/show/1055',
  );
});

test('buildReleaseSourceFromLandscape anchors an invention with payload.grantDate to a day-precision statusHistory', () => {
  const entry = buildReleaseSourceFromLandscape(
    inventionRow({ payload: { eraBuckets: ['1920s'], grantDate: '1923-11-20' } }),
  );
  assert.ok(entry);
  assert.equal(entry?.statusHistory?.length, 1);
  assert.equal(entry?.statusHistory?.[0]?.validFrom, '1923-11-20');
  assert.equal(entry?.statusHistory?.[0]?.datePrecision, 'day');
});

test('buildReleaseSourceFromLandscape leaves an invention row without payload.grantDate to fall back to the era year', () => {
  const entry = buildReleaseSourceFromLandscape(
    inventionRow({ payload: { eraBuckets: ['1920s'] } }),
  );
  assert.ok(entry);
  assert.equal(entry?.statusHistory, undefined);

  const derived = deriveCatalogEntityStatus({
    id: entry!.id,
    kind: entry!.kind,
    summary: entry!.summary,
    ...(entry!.eraBuckets !== undefined ? { eraBuckets: entry!.eraBuckets } : {}),
  });
  assert.equal(derived.statusHistory?.[0]?.validFrom, '1920');
  assert.equal(derived.statusHistory?.[0]?.datePrecision, 'year');
});

test('gateLandscapePublishCandidate rejects person privacy holds', () => {
  const result = gateWithReviewedClaims({
    row: baseRow({ kind: 'person' }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'person_kind');
});

test('gateLandscapePublishCandidate lets an operator-reviewed person past the privacy hold', () => {
  const reviewed = baseRow({
    kind: 'person',
    payload: {
      personReview: {
        approved: true,
        approvedBy: 'operator',
        approvedAt: '2026-07-28T00:00:00.000Z',
        basis: 'deceased historical figure',
      },
    },
  });
  const result = gateWithReviewedClaims({
    row: reviewed,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  // Passes the person hold; may still fail later gates, but not person_kind.
  if (!result.eligible) assert.notEqual(result.reason, 'person_kind');
});

test('gateLandscapePublishCandidate rejects incomplete personReview markers', () => {
  const result = gateWithReviewedClaims({
    row: baseRow({ kind: 'person', payload: { personReview: { approved: true } } }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'person_kind');
});

test('gateLandscapePublishCandidate rejects greenbook lane', () => {
  const result = gateWithReviewedClaims({
    row: baseRow({ lane: 'greenbook' }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'greenbook_lane');
});

test('gateLandscapePublishCandidate rejects already-in-public rows', () => {
  const result = gateWithReviewedClaims({
    row: baseRow({ exact_in_release: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'already_in_public');
});

test('gateLandscapePublishCandidate allowRepublish lets an already-published row past already_in_public', () => {
  const result = gateWithReviewedClaims({
    row: baseRow({ exact_in_release: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
  });
  if (!result.eligible) assert.notEqual(result.reason, 'already_in_public');
});

const nrhpRow = (overrides: Partial<LandscapePublishRow> = {}): LandscapePublishRow =>
  baseRow({
    id: 'nrhp-black-heritage-71000836',
    lane: 'nrhp-black-heritage',
    display_name: 'Tri-State Bank',
    summary:
      'Tri-State Bank is a building in Memphis, Shelby County, Tennessee listed on the National ' +
      'Register of Historic Places on July 30, 1971 for its significance in Black heritage and ' +
      "performing arts. The National Park Service's National Register program recognizes it as " +
      'a documented site of African American historical importance. The nomination records the ' +
      'bank as a Beale Street institution serving Black-owned businesses through the mid-twentieth ' +
      'century, and its listing recognizes that role alongside the building itself as a landmark ' +
      'of the district.',
    canonical_url: 'https://npgallery.nps.gov/AssetDetail/NRIS/71000836',
    payload: {
      refnum: '71000836',
      listedDateSerial: '26146',
      areaOfSignificance: 'BLACK; PERFORMING ARTS',
    },
    ...overrides,
  });

test('buildReleaseSourceFromLandscape gives the NRHP lane a distinct listing-fact claim and a distinct significance claim', () => {
  const entry = buildReleaseSourceFromLandscape(nrhpRow());
  assert.ok(entry);
  assert.equal(entry?.claims?.length, 2);

  const [listing, significance] = entry!.claims!;
  // claims[0].object is the listing FACT — never a copy of `summary`.
  assert.notEqual(listing!.object, entry!.summary);
  // Fragment, not a full sentence — see buildNrhpListingFactObject's doc comment: a full
  // "Listed on..." sentence collides with formatClaimInclusionNote's own "Listing" lead when
  // the claim renders as prose ("Listing Listed on...").
  assert.match(listing!.object, /^on the National Register of Historic Places/);
  assert.match(listing!.object, /reference #71000836/);

  // The significance claim is distinct prose from both the summary and the listing-fact object,
  // and the raw NPS code never leaks through as "(Black)" or similar.
  assert.notEqual(significance!.object, entry!.summary);
  assert.notEqual(significance!.object, listing!.object);
  assert.doesNotMatch(significance!.object, /\(black/i);
  assert.match(significance!.object, /Black heritage/);
});

test('buildReleaseSourceFromLandscape keeps the single-claim shape for non-NRHP lanes', () => {
  const entry = buildReleaseSourceFromLandscape(baseRow());
  assert.equal(entry?.claims?.length, 1);
  assert.equal(entry?.claims?.[0]?.object, entry?.summary);
});

/**
 * A DC site stub built purely from the inventory row: its one claim is the summary restated, and
 * its only citation is the inventory page itself. This shape used to publish — it is the shape
 * that put template-only records in front of readers — and the depth gate now holds it back.
 */
test('gateLandscapePublishCandidate holds back a row whose only claim restates its summary', () => {
  const result = gateWithReviewedClaims({
    row: baseRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) {
    assert.equal(result.reason, 'template_only');
    assert.match(result.detail, /restates the summary/u);
  }
});

test('gateLandscapePublishCandidate holds back a generated NRHP template summary', () => {
  const result = gateWithReviewedClaims({
    row: nrhpRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) {
    assert.equal(result.reason, 'template_only');
    assert.match(result.detail, /generated-template signature/u);
  }
});

/**
 * Distinguishes an absent draft from a validated draft that has not been staged when reporting
 * a template-only record.
 */
test('template_only detail names an unstaged newer enrichment draft when one exists', () => {
  const result = gateWithReviewedClaims({
    row: nrhpRow({ enrichment_draft_unstaged: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) {
    assert.equal(result.reason, 'template_only');
    assert.match(result.detail, /generated-template signature/u);
    assert.match(result.detail, /apply-enrichment-to-landscape/u);
  }
});

/** The same rejection with no unstaged draft says nothing about one — the default (`undefined`) case. */
test('template_only detail stays silent about a draft when none is unstaged', () => {
  const result = gateWithReviewedClaims({
    row: nrhpRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.doesNotMatch(result.detail, /apply-enrichment-to-landscape/u);
});

/**
 * Exercises depth admission and non-regression decisions using the same shallow candidate with
 * different published-state inputs.
 */

/** The live baseline: a shallow published row, the shape 2,360 live records are in. */
const shallowLiveRow = () => ({
  summary: 'Historic site listed on the National Register. ethnic heritage (Black)',
  claims: [],
  projection: {},
});

/** A live row a sweep has enriched — deep, and therefore not overwritable by template prose. */
const deepLiveRow = () => ({
  summary: 'Founded in 1881 by formerly enslaved families and served the county until 1968.',
  claims: [],
  projection: { historicalContext: 'A researched paragraph written from fetched sources.' },
});

test('depth gate still rejects a shallow candidate for a record that is NOT live', () => {
  const result = gateWithReviewedClaims({
    row: nrhpRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
    liveDepth: { deep: false, detail: 'irrelevant — the candidate is not in the release' },
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'template_only');
});

test('depth gate lets a corrected summary replace SHALLOW published prose', () => {
  const row = nrhpRow({ exact_in_release: true });
  const liveDepth = assessLandscapeDepth(buildLiveDepthEntry(shallowLiveRow()), row);
  assert.equal(liveDepth.deep, false);

  const result = gateWithReviewedClaims({
    row,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
    liveDepth,
  });
  assert.equal(result.eligible, true);
});

test('depth gate refuses to replace DEEP published prose with a shallow candidate', () => {
  const row = nrhpRow({ exact_in_release: true });
  const liveDepth = assessLandscapeDepth(buildLiveDepthEntry(deepLiveRow()), row);
  assert.equal(liveDepth.deep, true);

  const result = gateWithReviewedClaims({
    row,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
    liveDepth,
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'template_only');
});

/**
 * The fail-closed default. A caller that never loaded live state gets the strict admission test,
 * so forgetting to pass `liveDepth` cannot silently widen what publishes.
 */
test('depth gate falls back to the strict admission test when live state is unknown', () => {
  const result = gateWithReviewedClaims({
    row: nrhpRow({ exact_in_release: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'template_only');
});

/**
 * Name overlap blocks new admission but does not itself establish regression of an
 * already-published record.
 */
test('name_overlap still blocks a NEW candidate whose name collides with a live entity', () => {
  const result = gateWithReviewedClaims({
    row: enrichedRow({ name_overlap: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'name_overlap');
});

test('name_overlap still blocks a colliding candidate that is NOT already live, even on a republish run', () => {
  const result = gateWithReviewedClaims({
    row: enrichedRow({ name_overlap: true, exact_in_release: false }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'name_overlap');
});

test('name_overlap does not block an in-place correction of a row already live under its own id', () => {
  const result = gateWithReviewedClaims({
    row: enrichedRow({ name_overlap: true, exact_in_release: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
  });
  assert.equal(result.eligible, true);
});

/**
 * Report content and location blockers before name overlap so the reason identifies the first
 * actionable constraint.
 */
const shortNrhpTemplateRow = (overrides: Partial<LandscapePublishRow> = {}): LandscapePublishRow =>
  nrhpRow({
    id: 'nrhp-black-heritage-100011560',
    display_name: 'Lincoln School',
    summary:
      'Lincoln School is a building in Marceline, Linn County, Missouri listed on the National ' +
      'Register of Historic Places on March 20, 2025 for its significance in Black heritage and ' +
      "architecture. The National Park Service's National Register program recognizes it as a " +
      'documented site of African American historical importance.',
    canonical_url: 'https://npgallery.nps.gov/AssetDetail/NRIS/100011560',
    payload: { refnum: '100011560', areaOfSignificance: 'ETHNIC HERITAGE-BLACK' },
    ...overrides,
  });

test('a name-overlapping candidate that is also too short reports the length, not the collision', () => {
  const row = shortNrhpTemplateRow({ name_overlap: true });
  const length = row.summary!.length;
  assert.ok(length >= 319 && length <= 392, `fixture must sit in the measured band, got ${length}`);

  const result = gateWithReviewedClaims({
    row,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  // Not 'name_overlap': a person adjudicating this collision would not make the row publishable.
  if (!result.eligible) assert.equal(result.reason, 'summary_too_short');
});

test('a name-overlapping candidate with no coordinates reports the missing location', () => {
  const result = gateWithReviewedClaims({
    row: enrichedRow({ name_overlap: true, lat: null, lng: null }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'missing_location');
});

test('the collision is still what blocks a candidate that is otherwise publish-ready', () => {
  const clean = gateWithReviewedClaims({
    row: enrichedRow({ name_overlap: false }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(clean.eligible, true, 'the fixture must clear every other gate');

  const colliding = gateWithReviewedClaims({
    row: enrichedRow({ name_overlap: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(colliding.eligible, false);
  if (!colliding.eligible) assert.equal(colliding.reason, 'name_overlap');
});

/**
 * A republished shallow record must retain its thin-evidence disclosure.
 */
test('a regression-clause republish publishes researchCoverage=minimal', () => {
  const row = nrhpRow({ exact_in_release: true });
  const result = gateWithReviewedClaims({
    row,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
    liveDepth: assessLandscapeDepth(buildLiveDepthEntry(shallowLiveRow()), row),
  });
  assert.equal(result.eligible, true);
  if (result.eligible) {
    const build = buildReleaseEntityArtifacts(result.entry, {
      releaseId: 'rel_seed_001',
      generatedAt: '2026-07-22T00:00:00.000Z',
    });
    assert.equal(build.ok, true);
    assert.equal(build.ok && build.projection.researchCoverage, 'minimal');
  }
});

/**
 * The enriched counterpart: same lane, same registry row, but a sweep has written historical
 * context from fetched sources. That is what the gate is for — it separates researched records
 * from generated ones, not one lane from another.
 */
test('gateLandscapePublishCandidate publishes a row once enrichment has written context', () => {
  const enriched = baseRow({
    payload: { historicalContext: 'x' },
  });
  const entry = buildReleaseSourceFromLandscape(enriched);
  assert.ok(entry);
  const withContext = {
    ...entry!,
    historicalContext:
      'Gardner Bishop, a barber with no formal legal training, organized the Consolidated ' +
      'Parent Group out of this shop and drove the school-desegregation suit that became Bolling ' +
      'v. Sharpe, decided the same day as Brown.',
  };
  assert.equal(assessLandscapeDepth(withContext, enriched).deep, true);

  const build = buildReleaseEntityArtifacts(withContext, {
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(build.ok, true);
  if (build.ok) {
    const row = toReleaseEntityRow(build.projection);
    assert.equal(row.entity_id, 'dc-black-history-sites-b10');
    assert.equal(row.release_id, 'rel_seed_001');
  }
});

test('assessLandscapeDepth accepts a claim cited to a host other than the registry itself', () => {
  const row = baseRow();
  const entry = buildReleaseSourceFromLandscape(row);
  assert.ok(entry);
  const withSecondSource = {
    ...entry!,
    claims: [
      ...(entry!.claims ?? []),
      {
        predicate: 'documented_in',
        object: 'a 1953 Washington Post account of the Consolidated Parent Group',
        confidenceLevel: 'high' as const,
        citationSource: 'chroniclingamerica.loc.gov',
        citationHref: 'https://chroniclingamerica.loc.gov/lccn/sn83045433/1953-06-09/ed-1/seq-1/',
        citationLabel: 'Chronicling America',
      },
    ],
  };
  assert.equal(assessLandscapeDepth(withSecondSource, row).deep, true);
});

test('assessLandscapeDepth counts a nomination form on the registry own host as real evidence', () => {
  // The NRHP nomination form is the richest source the lane has and it is served by the same
  // host as the index entry. A host-level comparison would reject the best-researched records
  // in the corpus; the comparison is per-document for exactly this case.
  const row = nrhpRow();
  const entry = buildReleaseSourceFromLandscape(row);
  assert.ok(entry);
  const withNomination = {
    ...entry!,
    claims: [
      ...(entry!.claims ?? []),
      {
        predicate: 'documented_in',
        object: 'the property nomination form statement of significance',
        confidenceLevel: 'high' as const,
        citationSource: 'npgallery.nps.gov',
        citationHref: 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/71000836_text',
        citationLabel: 'NRHP nomination form',
      },
    ],
  };
  assert.equal(assessLandscapeDepth(withNomination, row).deep, true);
});

test('buildReleaseSourceFromLandscape carries enrichment historicalContext onto the entry', () => {
  // Without the passthrough the builder rebuilds from index fields and drops swept prose, so a
  // researched record would republish exactly as thin as it was before the sweep.
  const entry = buildReleaseSourceFromLandscape(enrichedRow());
  assert.ok(entry);
  assert.match(entry!.historicalContext ?? '', /Consolidated Parent Group/u);
});

test('buildReleaseSourceFromLandscape carries enrichment topicIds/eraBuckets/keywords onto the entry', () => {
  // Preserve every supported enrichment output field through the publication adapter.
  const entry = buildReleaseSourceFromLandscape(
    enrichedRow({
      payload: {
        historicalContext: 'x',
        topicIds: ['school-desegregation', 'civil-rights'],
        eraBuckets: ['1950s'],
        keywords: ['Gardner Bishop', 'Bolling v. Sharpe'],
      },
    }),
  );
  assert.ok(entry);
  assert.deepEqual(entry!.topicIds, ['school-desegregation', 'civil-rights']);
  assert.deepEqual(entry!.eraBuckets, ['1950s']);
  assert.deepEqual(entry!.keywords, ['Gardner Bishop', 'Bolling v. Sharpe']);
});

test('buildReleaseSourceFromLandscape carries payload.mentionedEntityIds onto the entry', () => {
  // Preserve related entity identifiers when adopting or republishing a cohort record.
  const entry = buildReleaseSourceFromLandscape(
    enrichedRow({
      payload: {
        historicalContext: 'x',
        mentionedEntityIds: ['ent_naacp_001', 'ent_some_org_002'],
      },
    }),
  );
  assert.ok(entry);
  assert.deepEqual(entry!.mentionedEntityIds, ['ent_naacp_001', 'ent_some_org_002']);
});

test('buildReleaseSourceFromLandscape publishes an empty mentionedEntityIds when the payload has none', () => {
  const entry = buildReleaseSourceFromLandscape(
    enrichedRow({ payload: { historicalContext: 'x' } }),
  );
  assert.ok(entry);
  assert.deepEqual(entry!.mentionedEntityIds, []);
});

test('buildReleaseSourceFromLandscape ignores non-string entries and a missing field', () => {
  const entry = buildReleaseSourceFromLandscape(
    enrichedRow({ payload: { historicalContext: 'x', topicIds: ['music', 42, null] } }),
  );
  assert.ok(entry);
  assert.deepEqual(entry!.topicIds, ['music']);
  assert.deepEqual(entry!.eraBuckets, undefined);
  assert.deepEqual(entry!.keywords, undefined);
});

test('assessLandscapeDepth does not count a lane-constant corroborating URL as a second source', () => {
  // The DC catalog URL is identical on every row in the lane; counting it would pass the whole
  // lane on one shared link. Only the row's own claim citations are evidence here.
  const row = baseRow();
  const entry = buildReleaseSourceFromLandscape(row);
  assert.ok(entry);
  assert.equal(assessLandscapeDepth(entry!, row).deep, false);
});

test('incrementalPublishProvenancePatch records publish metadata', () => {
  const patch = incrementalPublishProvenancePatch('dc-black-history-sites-b10');
  assert.equal(patch.publishedReleaseEntityId, 'dc-black-history-sites-b10');
  assert.ok(typeof patch.incremental_publish === 'string');
});

test('parseCanonicalStatusSnapshot maps canonical row fields', () => {
  const snapshot = parseCanonicalStatusSnapshot({
    entity_id: 'ent-1',
    living_status: 'deceased',
    status_history: [],
    kind_detail: {},
  });
  assert.equal(snapshot?.livingStatus, 'deceased');
});

/** A fake `entity_visit` + `entity_locations` join result, as `preparePublish` would load it. */
const canonicalVisitRow = (overrides: Partial<CanonicalVisitRow> = {}): CanonicalVisitRow => ({
  phone_e164: '+12025551234',
  phone_display: '(202) 555-1234',
  website: 'https://example.org',
  hours: 'Mon-Fri 9am-5pm',
  visitability: 'open_to_public',
  source_ids: ['claim-1'],
  street: '1900 15th Street NW',
  postal_code: '20009',
  ...overrides,
});

test('visitOverrideFromCanonicalRow composes a raw PublicVisit from entity_visit + entity_locations columns', () => {
  const visit = visitOverrideFromCanonicalRow(enrichedRow(), canonicalVisitRow());
  assert.ok(visit);
  assert.equal(visit?.address?.street, '1900 15th Street NW');
  assert.equal(visit?.address?.city, 'Washington');
  assert.equal(visit?.address?.state, 'District of Columbia');
  assert.equal(visit?.address?.postalCode, '20009');
  assert.deepEqual(visit?.phone, { e164: '+12025551234', display: '(202) 555-1234' });
  assert.equal(visit?.website, 'https://example.org');
  assert.equal(visit?.hours, 'Mon-Fri 9am-5pm');
  assert.equal(visit?.visitability, 'open_to_public');
  assert.deepEqual(visit?.sources, ['claim-1']);
});

test('visitOverrideFromCanonicalRow returns undefined when canonical has no visit or address data', () => {
  const visit = visitOverrideFromCanonicalRow(
    enrichedRow(),
    canonicalVisitRow({
      phone_e164: null,
      phone_display: null,
      website: null,
      hours: null,
      visitability: null,
      source_ids: null,
      street: null,
      postal_code: null,
    }),
  );
  assert.equal(visit, undefined);
});

/**
 * A lane republish rebuilds `ReleaseSourceEntity` from the landscape row alone, which
 * never carries phone/website/hours/street — that data lives only in
 * `canonical.entity_visit`/`entity_locations`. Before `visitOverride` was threaded through the
 * gate and the artifact build, a republish of an already-live, already-enriched record silently
 * dropped that block; this proves the same republish now carries it through when the caller
 * supplies the canonical visit row it loaded, and confirms it does NOT appear without one.
 */
test('a lane republish preserves phone/website/hours/street via visitOverride from canonical tables', () => {
  const row = enrichedRow();
  const visitOverride = visitOverrideFromCanonicalRow(row, canonicalVisitRow());
  assert.ok(visitOverride);

  const gateWithoutOverride = gateWithReviewedClaims({
    row,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
  });
  assert.equal(gateWithoutOverride.eligible, true);
  if (!gateWithoutOverride.eligible) return;
  const builtWithoutOverride = buildArtifactsForEntry({
    entry: gateWithoutOverride.entry,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(builtWithoutOverride.ok, true);
  if (!builtWithoutOverride.ok) return;
  // Confirms the bug this fixes: the landscape row alone rebuilds no visit block at all.
  assert.equal((builtWithoutOverride.entityRow.projection as { visit?: unknown }).visit, undefined);

  const gateWithOverride = gateWithReviewedClaims({
    row,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
    visitOverride,
  });
  assert.equal(gateWithOverride.eligible, true);
  if (!gateWithOverride.eligible) return;
  const built = buildArtifactsForEntry({
    entry: gateWithOverride.entry,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    visitOverride,
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const visit = (built.entityRow.projection as { visit?: PublicVisit }).visit;
  assert.ok(visit);
  assert.equal(visit?.phone?.display, '(202) 555-1234');
  assert.equal(visit?.website, 'https://example.org');
  assert.equal(visit?.hours, 'Mon-Fri 9am-5pm');
  assert.equal(visit?.address?.street, '1900 15th Street NW');
});

test('buildArtifactsForEntry publishes canonical deceased even when personReview says living', () => {
  const reviewed = baseRow({
    kind: 'person',
    summary:
      'A'.repeat(300) +
      ' A community leader who was assassinated in 1968 during the struggle for civil rights in Washington, DC.',
    payload: {
      // Present so the row clears the depth gate; this test is about status resolution, not depth.
      historicalContext: 'Swept context standing in for a researched biography.',
      personReview: {
        approved: true,
        approvedBy: 'operator',
        approvedAt: '2026-07-28T00:00:00.000Z',
        basis: 'deceased historical figure',
        livingStatus: 'living',
      },
    },
  });
  const gate = gateWithReviewedClaims({
    row: reviewed,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    canonicalStatus: { livingStatus: 'deceased' },
  });
  assert.equal(gate.eligible, true);
  if (!gate.eligible) return;
  const built = buildArtifactsForEntry({
    entry: gate.entry,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    canonicalStatus: { livingStatus: 'deceased' },
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal((built.entityRow.projection as { status?: string }).status, 'deceased');
});

test('toReleaseEntityRow normalizes empty related to array', () => {
  const result = gateWithReviewedClaims({
    row: enrichedRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  const build = buildReleaseEntityArtifacts(result.entry, {
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(build.ok, true);
  if (!build.ok) return;
  const row = toReleaseEntityRow(build.projection);
  // The normalization now lands IN the projection, which is what readers serve and what the
  // generated `related` column derives from. Asserting on a column here would have asserted on the
  // copy nobody reads.
  const related = (row.projection as Record<string, unknown>)['related'];
  assert.ok(Array.isArray(related));
  assert.deepEqual(related, []);
});

test('canonicalUpsertParamsFromLandscape maps personReview livingStatus', () => {
  const params = canonicalUpsertParamsFromLandscape(
    baseRow({
      kind: 'person',
      payload: {
        personReview: {
          approved: true,
          approvedBy: 'operator',
          approvedAt: '2026-07-28T00:00:00.000Z',
          basis: 'deceased historical figure',
          livingStatus: 'deceased',
        },
      },
    }),
    'dc-black-history-sites-b10',
  );
  assert.equal(params.livingStatus, 'deceased');
  assert.equal(params.kind, 'person');
});

/**
 * Published citations must include the documents used by the enrichment draft, not only its
 * discovery registry.
 */
test('buildReleaseSourceFromLandscape cites the evidence documents an enriched record was written from', () => {
  const entry = buildReleaseSourceFromLandscape(
    nrhpRow({
      payload: {
        refnum: '71000836',
        listedDateSerial: '26146',
        areaOfSignificance: 'BLACK; PERFORMING ARTS',
        evidenceCitations: [
          {
            sourceUrl: 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/71000836_text',
            title: 'National Register nomination — Example Hall',
            sourceTier: 'tier1',
            quote: 'the hall served as the social center of the Black community',
          },
          {
            sourceUrl: 'https://en.wikipedia.org/wiki/Example_Hall',
            title: 'Example Hall',
            sourceTier: 'tier2',
            quote: 'built in 1912 by a benevolent society',
          },
        ],
      },
    }),
  );
  assert.ok(entry);
  // Two registry claims plus one per distinct evidence document.
  assert.equal(entry?.claims?.length, 4);

  // Selected by predicate, not host: the NRHP fixture's own canonical_url is an npgallery URL,
  // so a host match would find the registry listing claim instead. They are different DOCUMENTS
  // on the same host — exactly the case documentKey() exists to tell apart.
  const nomination = entry!.claims!.find((claim) => claim.predicate === 'source states');
  assert.ok(nomination, 'expected a claim citing the nomination form');
  assert.equal(nomination!.object, 'the hall served as the social center of the Black community');
  assert.equal(nomination!.confidenceLevel, 'high', 'a government record is authoritative');
  assert.equal(nomination!.claimRole, 'evidence', 'a document read is evidence, not provenance');
  assert.equal(nomination!.citationLabel, 'National Register nomination — Example Hall');

  // Match on the parsed host, not a substring of the URL. `includes('en.wikipedia.org')` also
  // matches en.wikipedia.org.evil.test and any path containing the string, which is why CodeQL
  // flags the pattern (js/incomplete-url-substring-sanitization). Harmless in a fixture-driven
  // test, but the test should model how the host is actually identified.
  const wiki = entry!.claims!.find(
    (claim) =>
      claim.citationHref !== undefined && hostOf(claim.citationHref) === 'en.wikipedia.org',
  );
  assert.equal(nomination!.predicate, 'source states');
  assert.ok(wiki);
  // Wikipedia-only evidence is low and does not add an independently corroborating lineage to
  // the record grade.
  assert.equal(wiki!.confidenceLevel, 'low', 'Wikipedia carries a claim, it does not corroborate');
});

test('evidence citations never duplicate a document already cited', () => {
  const registryUrl = 'https://catalog.archives.gov/id/77843341';
  const entry = buildReleaseSourceFromLandscape(
    nrhpRow({
      canonical_url: registryUrl,
      payload: {
        refnum: '71000836',
        evidenceCitations: [
          // The registry row itself, re-cited by the draft — must not become a second "document".
          { sourceUrl: registryUrl, title: 'registry', sourceTier: 'tier1', quote: 'listed 1971' },
          // The same nomination form twice, with url noise that must not split it in two.
          {
            sourceUrl: 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/71000836_text',
            title: 'nomination',
            sourceTier: 'tier1',
            quote: 'first quote',
          },
          {
            sourceUrl: 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/71000836_text/',
            title: 'nomination',
            sourceTier: 'tier1',
            quote: 'second quote',
          },
        ],
      },
    }),
  );
  assert.ok(entry);
  assert.equal(entry?.claims?.length, 3, 'two registry claims + exactly one nomination document');
  const nominationClaims = entry!.claims!.filter((claim) =>
    claim.citationHref?.includes('npgallery'),
  );
  assert.equal(nominationClaims.length, 1);
  // One document is still one claim, but the second passage is carried rather than discarded.
  assert.equal(nominationClaims[0]?.object, 'first quote … second quote');
});

test('a second passage from one document is merged into its claim, not dropped', () => {
  const encyclopedia = 'https://encyclopediaofalabama.org/article/andrew-jackson-beard/';
  const entry = buildReleaseSourceFromLandscape(
    nrhpRow({
      canonical_url: 'https://patents.google.com/patent/US594059A',
      payload: {
        evidenceCitations: [
          {
            sourceUrl: encyclopedia,
            title: 'Encyclopedia of Alabama',
            quote: 'walking the streets of Birmingham',
          },
          {
            sourceUrl: encyclopedia,
            title: 'Encyclopedia of Alabama',
            quote: 'patented by Eli Janney in 1873',
          },
        ],
      },
    }),
  );
  const cited = entry!.claims!.filter((claim) => claim.citationHref === encyclopedia);
  // The grade is bought with documents, so one document still buys exactly one claim.
  assert.equal(cited.length, 1);
  assert.equal(
    cited[0]?.object,
    'walking the streets of Birmingham … patented by Eli Janney in 1873',
  );
});

test('the same passage cited twice is not repeated inside the merged claim', () => {
  const url = 'https://www.nps.gov/articles/example.htm';
  const entry = buildReleaseSourceFromLandscape(
    nrhpRow({
      canonical_url: 'https://catalog.archives.gov/id/77843341',
      payload: {
        evidenceCitations: [
          { sourceUrl: url, title: 'NPS', quote: 'the same sentence' },
          { sourceUrl: url, title: 'NPS', quote: 'The same sentence.' },
        ],
      },
    }),
  );
  const cited = entry!.claims!.filter((claim) => claim.citationHref === url);
  assert.equal(cited.length, 1);
  assert.equal(cited[0]?.object, 'the same sentence');
});

test('merging stops at the cap, so a document cited many times is not a wall of quotations', () => {
  const url = 'https://www.nps.gov/articles/long.htm';
  const long = 'q'.repeat(400);
  const entry = buildReleaseSourceFromLandscape(
    nrhpRow({
      canonical_url: 'https://catalog.archives.gov/id/77843341',
      payload: {
        evidenceCitations: [
          { sourceUrl: url, title: 'NPS', quote: long },
          { sourceUrl: url, title: 'NPS', quote: 'b'.repeat(400) },
        ],
      },
    }),
  );
  const cited = entry!.claims!.filter((claim) => claim.citationHref === url);
  assert.equal(cited.length, 1);
  assert.equal(cited[0]?.object, long, 'the passage that would breach the cap is dropped');
  assert.ok((cited[0]?.object.length ?? 0) <= MERGED_EVIDENCE_QUOTE_MAX_CHARS);
});

test('a malformed or empty evidence citation is dropped, never published as a broken link', () => {
  const entry = buildReleaseSourceFromLandscape(
    nrhpRow({
      payload: {
        refnum: '71000836',
        evidenceCitations: [
          { sourceUrl: 'not a url', title: 'x', sourceTier: 'tier1', quote: 'something' },
          { sourceUrl: 'https://example.org/doc', title: 'y', sourceTier: 'tier1', quote: '   ' },
          { sourceUrl: '', title: 'z', sourceTier: 'tier1', quote: 'something' },
          'not an object',
        ],
      },
    }),
  );
  assert.ok(entry);
  assert.equal(entry?.claims?.length, 2, 'only the two registry claims survive');
});

/**
 * The population this unblocks: a record with a real evidence-backed summary but no
 * historicalContext paragraph. Six of the first live batch of 21 were rejected this way — the
 * research was done, the projection just could not show it.
 */
test('gateLandscapePublishCandidate admits a null-context record that cites a real evidence document', () => {
  const row = nrhpRow({
    summary:
      'John McKenzie, a former fugitive slave, built this Greek Revival frame house about 1847, and it became the home he shared with Harriet McKenzie in Oswego, New York.',
    payload: {
      refnum: '71000836',
      evidenceCitations: [
        {
          sourceUrl: 'https://en.wikipedia.org/wiki/McKenzie_House',
          title: 'McKenzie House',
          sourceTier: 'tier2',
          quote: 'Its owner John McKenzie was a former fugitive slave',
        },
      ],
    },
  });
  const entry = buildReleaseSourceFromLandscape(row);
  assert.ok(entry);
  assert.equal(
    entry!.historicalContext,
    undefined,
    'no narrative paragraph — depth must not rely on one',
  );
  assert.equal(assessLandscapeDepth(entry!, row).deep, true);
});

/**
 * The writer/reader round-trip for `search_index.facets`.
 *
 * This test exists because the two halves drifted apart silently. `toSearchIndexRow` carried five
 * keys; `mapPostgresSearchIndexRow` reads eleven that no column backs, and `upsertSearchIndex`
 * writes `facets = EXCLUDED.facets` — a whole-object replace. A key the writer omitted was
 * therefore deleted from every row republished through this path, and nothing failed: the reader
 * defaults an absent facet instead of rejecting the row, so `/records` printed "Place not
 * recorded" over records whose own entity page printed a city.
 *
 * Asserting through the real reader rather than against a literal is the point. A future facet
 * key added to `mapPostgresSearchIndexRow` and not to `toSearchIndexRow` should fail here.
 */
test('toSearchIndexRow: facets survive a round-trip through the search-doc reader', () => {
  const gate = gateWithReviewedClaims({
    row: enrichedRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(gate.eligible, true);
  if (!gate.eligible) return;
  const built = buildArtifactsForEntry({
    entry: gate.entry,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;

  const projection = built.entityRow.projection as { readonly jurisdictionLabel?: string };
  // The record under test must actually have a jurisdiction, or the assertion below proves nothing.
  assert.ok(
    projection.jurisdictionLabel && projection.jurisdictionLabel.length > 0,
    'fixture must carry a jurisdictionLabel',
  );

  const doc = mapPostgresSearchIndexRow({
    ...built.searchRow,
    aliases: [...built.searchRow.aliases],
    topics: [...built.searchRow.topics],
  });
  assert.ok(doc, 'search row must parse as a public search doc');

  // The reported defect: /records reads this and nothing else for its place column.
  assert.equal(doc.jurisdictionState, projection.jurisdictionLabel);
  // Lost by the same omission, on the same records, for the same reason.
  assert.ok(Array.isArray(doc.topicIds));
  assert.ok(Array.isArray(doc.mentionedEntityIds));
  assert.ok(Array.isArray(doc.notabilityBasis));
  assert.ok(Array.isArray(doc.notabilityLabels));
});

/**
 * The one-directional rule the backfill depends on: a record with no jurisdiction of its own must
 * leave the facet absent rather than write an empty string over it. `''` would satisfy
 * `typeof facets.jurisdictionState === 'string'` in the reader and publish a blank place.
 */
test('toSearchIndexRow: an empty jurisdiction omits the facet rather than blanking it', () => {
  const row = toSearchIndexRow(
    {
      id: 'ent_test',
      releaseId: 'rel_seed_001',
      kind: 'invention',
      displayName: 'Test Record',
      nameLower: 'test record',
      aliases: [],
      summary: 'Summary.',
      topicTags: [],
      topicIds: [],
      mentionedEntityIds: [],
      keywords: [],
      jurisdictionState: '   ',
      eraBuckets: [],
      notabilityBasis: [],
      notabilityLabels: [],
      recordMaturity: 'minimum_record',
      researchCoverage: 'minimal',
      relatedCount: 0,
      claimCount: 0,
      evidenceInputs: {
        strongestClaimLevel: 'unrated',
        citedLineageKeys: [],
        evidenceLineageKeys: [],
      },
    },
    'dqcjq',
  );
  assert.equal(
    Object.hasOwn(row.facets as Record<string, unknown>, 'jurisdictionState'),
    false,
    'a whitespace-only jurisdiction must not be written',
  );
});

/*
 * Exercises location inheritance from an existing public record when the staging candidate
 * lacks coordinates. Retain the published point, precision and location description together.
 */
const curatedRow = (overrides: Partial<LandscapePublishRow> = {}): LandscapePublishRow => ({
  id: 'gap_boston_african_american_nhs',
  lane: 'other',
  kind: 'place',
  display_name: 'Boston African American National Historic Site',
  summary:
    'The Boston African American National Historic Site preserves the Beacon Hill buildings that ' +
    'housed the city’s nineteenth-century Black abolitionist community, including the African ' +
    'Meeting House and the Abiel Smith School. The National Park Service administers the site ' +
    'alongside the Black Heritage Trail, which links fourteen structures associated with the ' +
    'organizing that made Boston a center of the antislavery movement. The park was authorized in ' +
    '1980 and the buildings it interprets remain in use as museum and program space today.',
  lat: null,
  lng: null,
  canonical_url: 'https://www.nps.gov/boaf/index.htm',
  source_item_id: 'gap_boston_african_american_nhs',
  provenance: {},
  payload: {
    historicalContext:
      'The African Meeting House, built in 1806, is the oldest surviving Black church building ' +
      'in the United States and was the hall where William Lloyd Garrison founded the New ' +
      'England Anti-Slavery Society in 1832.',
    confidence: 0.82,
  },
  exact_in_release: true,
  name_overlap: false,
  ...overrides,
});

/** The live projection for the row above, in the shape `liveLocationFromRow` reads. */
const curatedLiveRow = () => ({
  summary: 'Short stale summary.',
  claims: [],
  projection: {
    location: {
      lat: 42.360006,
      lng: -71.065153,
      geohash: 'drt2y',
      geohashPrefixes: ['d', 'dr', 'drt', 'drt2', 'drt2y'],
      precision: 'address',
      matchMethod: 'geocode_other',
    },
    locationLabel: '46 Joy Street, Beacon Hill, Boston',
    jurisdictionLabel: 'Boston, Massachusetts',
  },
});

/**
 * `liveLocationFromRow` is correctly typed `| undefined`, and `exactOptionalPropertyTypes` rejects
 * that on the gate's optional `liveLocation`. The fixture always has a point, so assert it here
 * once rather than spreading a conditional through every call site below.
 */
const curatedLiveLocation = (): LiveLocationInheritance => {
  const live = liveLocationFromRow(curatedLiveRow());
  assert.ok(live, 'the curated fixture must carry a live location');
  return live;
};

test('liveLocationFromRow reads the point, precision, matchMethod and place prose', () => {
  assert.deepEqual(liveLocationFromRow(curatedLiveRow()), {
    lat: 42.360006,
    lng: -71.065153,
    precision: 'address',
    matchMethod: 'geocode_other',
    locationLabel: '46 Joy Street, Beacon Hill, Boston',
    jurisdictionLabel: 'Boston, Massachusetts',
  });
});

test('liveLocationFromRow offers nothing for a live row with no usable point', () => {
  assert.equal(liveLocationFromRow({ summary: null, claims: [], projection: null }), undefined);
  assert.equal(liveLocationFromRow({ summary: null, claims: [], projection: {} }), undefined);
  assert.equal(
    liveLocationFromRow({ summary: null, claims: [], projection: { location: {} } }),
    undefined,
    'a location object without coordinates is not a location',
  );
  assert.equal(
    liveLocationFromRow({
      summary: null,
      claims: [],
      projection: { location: { lat: '42.36', lng: -71.06 } },
    }),
    undefined,
    'a stringified coordinate must not be inherited',
  );
});

test('location gate still rejects a coordinate-less NEW candidate', () => {
  const result = gateWithReviewedClaims({
    row: curatedRow({ exact_in_release: false }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  assert.equal(result.eligible === false && result.reason, 'missing_location');
});

test('location gate rejects a coordinate-less row that is not live under its own id', () => {
  const result = gateWithReviewedClaims({
    row: curatedRow({ exact_in_release: false }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
    liveLocation: curatedLiveLocation(),
  });
  assert.equal(result.eligible, false);
  assert.equal(
    result.eligible === false && result.reason,
    'missing_location',
    '--republish alone is not a licence to borrow another record’s point',
  );
});

test('location gate fails closed when the caller loaded no live location', () => {
  const result = gateWithReviewedClaims({
    row: curatedRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
  });
  assert.equal(result.eligible, false);
  assert.equal(result.eligible === false && result.reason, 'missing_location');
});

test('republish keeps the location an already-live record publishes today', () => {
  const result = gateWithReviewedClaims({
    row: curatedRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
    liveLocation: curatedLiveLocation(),
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.equal(result.entry.lat, 42.360006);
  assert.equal(result.entry.lng, -71.065153);
  assert.equal(
    result.entry.locationPrecision,
    'address',
    'the live tier describes the live point; re-deriving it from a row with no geocode and no ' +
      'street address would publish "city" over an address-precision record',
  );
  assert.equal(result.entry.locationLabel, '46 Joy Street, Beacon Hill, Boston');
  assert.equal(
    result.entry.jurisdictionLabel,
    'Boston, Massachusetts',
    'findUsStateForPoint would answer "Massachusetts" and drop the city the page prints',
  );
  assert.deepEqual(result.locationOverride, {
    lat: 42.360006,
    lng: -71.065153,
    precision: 'address',
    matchMethod: 'geocode_other',
    locationLabel: '46 Joy Street, Beacon Hill, Boston',
  });
});

test('an inherited point does not overwrite place prose the landscape row supplies', () => {
  const result = gateWithReviewedClaims({
    row: curatedRow({
      provenance: {
        historicAddress: '46 Joy Street',
        sourceCity: 'Boston',
        sourceState: 'MA',
      },
    }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
    liveLocation: curatedLiveLocation(),
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.equal(result.entry.lat, 42.360006, 'the point still comes from the live record');
  assert.equal(result.entry.locationPrecision, 'address');
  assert.equal(
    result.entry.locationLabel,
    '46 Joy Street, Boston, MA',
    'a row that says where the record is stays the source of truth for what a reader is told',
  );
  assert.equal(result.entry.jurisdictionLabel, 'Boston, Massachusetts');
  assert.equal(
    result.locationOverride?.locationLabel,
    undefined,
    'the override must not re-assert a label the entry already owns',
  );
});

test('a row with its own coordinates ignores the live location entirely', () => {
  const result = gateWithReviewedClaims({
    row: enrichedRow({ exact_in_release: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
    liveLocation: curatedLiveLocation(),
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.equal(result.entry.lat, 38.915775, 'the landscape row wins when it has a point');
  assert.equal(result.locationOverride, undefined);
});

test('an inherited location survives the real build, matchMethod included', () => {
  const gate = gateWithReviewedClaims({
    row: curatedRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
    liveLocation: curatedLiveLocation(),
  });
  assert.equal(gate.eligible, true);
  if (!gate.eligible) return;

  const built = buildArtifactsForEntry({
    entry: gate.entry,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    ...(gate.locationOverride !== undefined ? { locationOverride: gate.locationOverride } : {}),
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;

  const live = curatedLiveRow().projection;
  const projection = built.entityRow.projection as {
    readonly location: Record<string, unknown>;
    readonly locationLabel: string;
    readonly jurisdictionLabel: string;
  };
  assert.equal(projection.location.lat, live.location.lat);
  assert.equal(projection.location.lng, live.location.lng);
  assert.equal(projection.location.geohash, live.location.geohash);
  assert.equal(projection.location.precision, live.location.precision);
  assert.equal(
    projection.location.matchMethod,
    'geocode_other',
    'matchMethod exists only on the override; dropping it republishes the point as manual_research',
  );
  assert.equal(projection.locationLabel, live.locationLabel);
  assert.equal(projection.jurisdictionLabel, live.jurisdictionLabel);
  const builtLocation = (built.entityRow.projection as Record<string, unknown>)['location'] as
    Record<string, unknown> | undefined;
  assert.equal(builtLocation?.['lat'], live.location.lat);
  assert.equal(builtLocation?.['lng'], live.location.lng);
  assert.equal(built.searchRow.geohash, live.location.geohash);
});

test('the build a republish writes is the build the gate approved', () => {
  const gate = gateWithReviewedClaims({
    row: curatedRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
    liveLocation: curatedLiveLocation(),
  });
  assert.equal(gate.eligible, true);
  if (!gate.eligible) return;

  // What the caller writes when it forgets to forward the override. The entry alone still
  // carries the right point, tier and labels — only matchMethod degrades — which is why
  // `inheritLiveLocation` writes to both and not just the override.
  const withoutOverride = buildArtifactsForEntry({
    entry: gate.entry,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
  });
  assert.equal(withoutOverride.ok, true);
  if (!withoutOverride.ok) return;
  const degraded = withoutOverride.entityRow.projection as {
    readonly location: Record<string, unknown>;
  };
  assert.equal(degraded.location.lat, 42.360006);
  assert.equal(degraded.location.precision, 'address');
  assert.equal(degraded.location.matchMethod, 'manual_research');
});

test('a live location whose tier was reduced by a sensitivity rule is not inherited', () => {
  const live = curatedLiveRow();
  const reduced = {
    ...live,
    projection: {
      ...live.projection,
      location: { ...live.projection.location, precisionReductionReason: 'restricted_site' },
    },
  };
  assert.equal(
    liveLocationFromRow(reduced),
    undefined,
    'reducePublicPrecision re-derives from inputs a landscape row does not carry, so feeding its ' +
      'own output back would republish the tier with the reason code silently dropped',
  );

  const result = gateWithReviewedClaims({
    row: curatedRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
  });
  assert.equal(result.eligible, false);
  assert.equal(
    result.eligible === false && result.reason,
    'missing_location',
    'the honest outcome is a skip, not a republish at a tier we cannot reproduce',
  );
});

test('a state without a city does not overwrite the city the live record prints', () => {
  const result = gateWithReviewedClaims({
    row: curatedRow({ provenance: { sourceState: 'MA' } }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
    liveLocation: curatedLiveLocation(),
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.equal(
    result.entry.jurisdictionLabel,
    'Boston, Massachusetts',
    'jurisdictionFromPlace would answer the bare "Massachusetts" from a state-only row, which ' +
      'does not contradict the live label — it just says less',
  );
  assert.equal(result.entry.locationLabel, '46 Joy Street, Beacon Hill, Boston');
});

test('a city named by the landscape row wins over the live jurisdiction', () => {
  const result = gateWithReviewedClaims({
    row: curatedRow({ provenance: { sourceCity: 'Cambridge', sourceState: 'MA' } }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
    liveLocation: curatedLiveLocation(),
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.equal(
    result.entry.jurisdictionLabel,
    'Cambridge, Massachusetts',
    'a row that names a city is at least as specific as the live label, so it stays authoritative',
  );
});

/*
 * A curated record can use its own cited evidence without a registry canonical_url. It still
 * needs reviewed claim assessments and the publication floor; a source-free row remains
 * blocked.
 */
const curatedEvidencePayload = {
  evidenceCitations: [
    {
      sourceUrl: 'https://en.wikipedia.org/wiki/African_Meeting_House',
      title: 'African Meeting House',
      quote:
        'The African Meeting House is the oldest Black church building still standing in the United States.',
    },
  ],
};

test('a curated row with no canonical_url publishes its evidence claim instead of skipping', () => {
  const result = gateWithReviewedClaims({
    row: curatedRow({ canonical_url: null, payload: curatedEvidencePayload }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
    liveLocation: curatedLiveLocation(),
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.equal(result.entry.claims?.length, 1);
  const claim = result.entry.claims?.[0];
  assert.equal(claim?.claimRole, 'evidence');
  assert.equal(
    claim?.object,
    'The African Meeting House is the oldest Black church building still standing in the United States.',
    'the object is the sentence the prose rests on, not a restatement of the whole summary',
  );
  assert.notEqual(claim?.object, result.entry.summary);
  assert.equal(claim?.citationHref, 'https://en.wikipedia.org/wiki/African_Meeting_House');
  assert.equal(
    result.entry.claims?.some((c) => c.claimRole === 'record_index'),
    false,
    'there is no registry index row to cite, so the record asserts none',
  );
});

test('a row with no canonical_url and no evidence citation still reports missing_canonical_url', () => {
  const result = gateWithReviewedClaims({
    row: curatedRow({ canonical_url: null, payload: {} }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
    liveLocation: curatedLiveLocation(),
  });
  assert.equal(result.eligible, false);
  assert.equal(result.eligible === false && result.reason, 'missing_canonical_url');
});

test('a row whose every evidence citation is unusable fails closed rather than publishing no claims', () => {
  // The cheap pre-check passes (a url string and a quote are both present) and the citation is
  // then dropped as unparseable, leaving an empty claims array. Without the fail-closed guard
  // after the evidence loop this row would publish asserting nothing and citing nothing.
  const result = gateWithReviewedClaims({
    row: curatedRow({
      canonical_url: null,
      payload: { evidenceCitations: [{ sourceUrl: 'not a url', title: 'x', quote: 'something' }] },
    }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
    allowRepublish: true,
    liveLocation: curatedLiveLocation(),
  });
  assert.equal(result.eligible, false);
  assert.equal(result.eligible === false && result.reason, 'missing_canonical_url');
});

test('a row WITH a canonical_url still leads with its record_index claim', () => {
  // The guard for the thousands of registry-backed records that publish through this path today:
  // nothing about a row that HAS an index entry changes.
  const entry = buildReleaseSourceFromLandscape(
    enrichedRow({
      payload: {
        historicalContext: 'Swept context standing in for a researched history.',
        evidenceCitations: [
          {
            sourceUrl: 'https://en.wikipedia.org/wiki/Example_Shop',
            title: 'Example Shop',
            quote: 'a fixture of the commercial corridor',
          },
        ],
      },
    }),
  );
  assert.ok(entry);
  const first = entry!.claims?.[0];
  assert.equal(first?.claimRole, 'record_index');
  assert.equal(first?.predicate, 'source states');
  assert.equal(first?.object, entry!.summary, 'the index claim still carries the whole summary');
  assert.equal(first?.citationHref, 'https://historicsites.dcpreservation.org/items/show/1055');
  assert.equal(entry!.claims?.length, 2, 'index claim plus one evidence document');
});

/*
 * An empty topicTags array must fall back to nonempty topicIds. Nullish coalescing alone cannot
 * implement that rule.
 */
const searchFields = (overrides: Record<string, unknown> = {}) => ({
  releaseId: 'rel_seed_001',
  id: 'ent_probe_001',
  displayName: 'Probe Record',
  nameLower: 'probe record',
  kind: 'place',
  aliases: [],
  topicTags: [],
  topicIds: [],
  mentionedEntityIds: [],
  keywords: [],
  jurisdictionState: '',
  eraBuckets: [],
  notabilityBasis: [],
  notabilityLabels: [],
  recordMaturity: 'minimum_record',
  researchCoverage: 'minimal',
  relatedCount: 0,
  claimCount: 0,
  evidenceInputs: {
    strongestClaimLevel: 'unrated',
    citedLineageKeys: [],
    evidenceLineageKeys: [],
  },
  ...overrides,
});

test('search topics fall through an EMPTY topicTags to the topic ids', () => {
  const row = toSearchIndexRow(
    searchFields({ topicTags: [], topicIds: ['invention', 'business', 'women'] }) as never,
    'dqcjq',
  );
  assert.deepEqual(
    row.topics,
    ['invention', 'business', 'women'],
    'an empty tag list is not a decision to publish no topics',
  );
});

test('search topics prefer display tags when the build has any', () => {
  const row = toSearchIndexRow(
    searchFields({ topicTags: ['Invention'], topicIds: ['invention'] }) as never,
    'dqcjq',
  );
  assert.deepEqual(row.topics, ['Invention']);
});

test('search topics are empty only when the build really has none', () => {
  const row = toSearchIndexRow(searchFields() as never, 'dqcjq');
  assert.deepEqual(row.topics, []);
});

test('toSearchIndexRow agrees with the invariant the divergence audit measures against', () => {
  for (const [topicTags, topicIds] of [
    [[], ['invention', 'business']],
    [['Invention'], ['invention']],
    [[], []],
    [['A', 'B'], []],
  ] as const) {
    const row = toSearchIndexRow(searchFields({ topicTags, topicIds }) as never, 'dqcjq');
    assert.deepEqual(
      [...row.topics].sort(),
      expectedSearchTopics({ topicTags, topicIds }),
      `topics disagreed with expectedSearchTopics for tags=${JSON.stringify(topicTags)} ids=${JSON.stringify(topicIds)}`,
    );
  }
});

/*
 * Feeds freshly built projection and search rows through the publisher's divergence checker.
 * Builder output must agree before persistence; a recording test does not replace the live
 * post-write check.
 */
const divergenceRowFromBuild = (built: {
  readonly entityRow: ReturnType<typeof toReleaseEntityRow>;
  readonly searchRow: ReturnType<typeof toSearchIndexRow>;
}) => {
  const entity = built.entityRow;
  const search = built.searchRow;
  /*
   * The eleven derived columns are GENERATED ALWAYS from `projection` in the database, so the
   * builder no longer produces them and this shim has to. It MIRRORS THE MIGRATION'S EXPRESSIONS
   * deliberately: what this test now proves is that the divergence audit's idea of where each
   * fact lives still matches what Postgres will compute, which is the thing that can silently
   * come apart now that one side is SQL.
   */
  const p = entity.projection as Record<string, unknown>;
  const location = p['location'] as Record<string, unknown> | undefined;
  const asArray = (value: unknown): unknown => (Array.isArray(value) ? value : []);
  return {
    entity_id: entity.entity_id,
    display_name: p['displayName'],
    kind: p['kind'],
    summary: p['summary'] ?? null,
    location: p['location'],
    geohash: location?.['geohash'] ?? null,
    lat: location?.['lat'] ?? null,
    lng: location?.['lng'] ?? null,
    claims: asArray(p['claims']),
    taxonomy: {
      topicIds: asArray(p['topicIds']),
      topicTags: asArray(p['topicTags']),
      ...(p['notabilityLabels'] !== undefined ? { notabilityLabels: p['notabilityLabels'] } : {}),
      ...(Array.isArray(p['campaignIds']) && p['campaignIds'].length > 0
        ? { campaignIds: p['campaignIds'] }
        : {}),
    },
    related: asArray(p['related']),
    primary_image: p['primaryImage'] ?? null,
    projection: entity.projection,
    si_present: true,
    si_kind: search.kind,
    si_status: search.status,
    si_topics: search.topics,
    si_facets: search.facets,
  };
};

test('a freshly built row does not diverge from its own projection', () => {
  const gate = gateWithReviewedClaims({
    row: enrichedRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
  });
  assert.equal(gate.eligible, true);
  if (!gate.eligible) return;
  const built = buildArtifactsForEntry({
    entry: gate.entry,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-12T00:00:00.000Z',
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;

  // `buildArtifactsForEntry` already ran both row builders; re-running them would test a shape the
  // publisher never writes.
  assert.deepEqual(
    divergentFieldsForRow(divergenceRowFromBuild(built) as never),
    [],
    'the publisher throws on any field listed here, after the upserts have already committed',
  );
});

test('the round-trip check would catch a topics writer that drops real topics', () => {
  const built = {
    entityRow: toReleaseEntityRow({
      releaseId: 'rel_seed_001',
      id: 'ent_probe_001',
      kind: 'place',
      displayName: 'Probe',
      nameLower: 'probe',
      summary: 'A summary.',
      location: {
        lat: 1,
        lng: 2,
        geohash: 'dqcjq',
        geohashPrefixes: ['d'],
        precision: 'city',
        matchMethod: 'manual_research',
      },
      claimIds: [],
      claims: [],
      jurisdictionLabel: 'Somewhere',
      locationLabel: 'Somewhere',
      topicIds: ['invention', 'business'],
      topicTags: [],
      related: [],
    } as never),
    // the pre-fix writer: an empty tag list winning over real ids
    searchRow: {
      ...toSearchIndexRow(searchFields({ topicIds: ['invention', 'business'] }) as never, 'dqcjq'),
      topics: [],
    },
  };
  assert.ok(
    divergentFieldsForRow(divergenceRowFromBuild(built) as never).includes('search_index.topics'),
    'an empty topics column over real projection topics must be reported, not tolerated',
  );
});

// Republishing must not silently shrink published evidence.

const LIVE_CLAIM = {
  id: 'claim_gap_tulsa_race_massacre_01',
  predicate: 'occurred',
  object: 'Tulsa Race Massacre',
  claimRole: 'evidence',
  citationHref: 'https://en.wikipedia.org/wiki/Tulsa_race_massacre',
  citationLabel: 'Wikipedia',
  citationSource: 'wikipedia_api',
  confidenceLevel: 'low',
};

function liveRow(claims: readonly unknown[]) {
  return { summary: 'A documented event.', claims, projection: null };
}

test('a live row round-trips into source claims, keeping its id', () => {
  const claims = liveSourceClaims(liveRow([LIVE_CLAIM]));
  assert.equal(claims.length, 1);
  assert.equal(claims[0]!.id, 'claim_gap_tulsa_race_massacre_01');
  assert.equal(claims[0]!.predicate, 'occurred');
  assert.equal(claims[0]!.citationSource, 'wikipedia_api');
  assert.equal(claims[0]!.claimRole, 'evidence');
});

test('a claim with no predicate or no object is not carried', () => {
  const claims = liveSourceClaims(
    liveRow([LIVE_CLAIM, { predicate: 'occurred', object: '   ' }, { object: 'orphan' }]),
  );
  assert.equal(claims.length, 1);
});

test('carrying keeps the fine-grained claims a rebuild would have dropped', () => {
  // The shape the gap_* records actually have: a rebuild produces one coarse claim whose object is
  // the summary, while the record already publishes several separately-cited facts.
  const rebuilt = [
    {
      predicate: 'source states',
      object: 'A long summary sentence about the massacre.',
      confidenceLevel: 'low' as const,
      citationSource: 'wikipedia_api',
      citationLabel: 'Wikipedia',
    },
  ];
  const live = liveRow([
    LIVE_CLAIM,
    { ...LIVE_CLAIM, id: 'claim_02', predicate: 'location', object: 'Greenwood District, Tulsa' },
    { ...LIVE_CLAIM, id: 'claim_03', predicate: 'date', object: 'May 31 - June 1, 1921' },
  ]);

  const carry = carryLiveClaims(rebuilt, live);
  assert.equal(carry.rebuilt, 1);
  assert.equal(carry.carried, 3);
  assert.equal(carry.claims.length, 4);
  assert.ok(!claimCountRegressed(carry.claims, live));
  // The rebuilt claim leads; the record's own facts survive behind it.
  assert.equal(carry.claims[0]!.predicate, 'source states');
  assert.deepEqual(
    carry.claims.slice(1).map((c) => c.predicate),
    ['occurred', 'location', 'date'],
  );
});

test('a rebuilt claim wins over a live claim stating the same fact', () => {
  const rebuilt = [
    {
      predicate: 'Occurred',
      object: '  tulsa race massacre  ',
      confidenceLevel: 'high' as const,
      citationSource: 'okhistory.org',
      citationLabel: 'Oklahoma Historical Society',
    },
  ];
  const carry = carryLiveClaims(rebuilt, liveRow([LIVE_CLAIM]));

  // Same predicate and object modulo case and padding, so it is one fact, not two.
  assert.equal(carry.claims.length, 1);
  assert.equal(carry.carried, 0);
  assert.equal(carry.claims[0]!.citationSource, 'okhistory.org');
});

test('a record with nothing live carries nothing and is not a regression', () => {
  const rebuilt = [
    {
      predicate: 'source states',
      object: 'Something.',
      confidenceLevel: 'low' as const,
      citationSource: 'wikipedia_api',
      citationLabel: 'Wikipedia',
    },
  ];
  const carry = carryLiveClaims(rebuilt, undefined);
  assert.equal(carry.claims.length, 1);
  assert.equal(carry.carried, 0);
  assert.equal(carry.liveCount, 0);
  assert.equal(claimCountRegressed(carry.claims, undefined), false);
});

test('the regression control fires when the union is bypassed', () => {
  // Exactly what the carry exists to prevent: publishing the rebuild alone.
  const rebuiltOnly = [
    {
      predicate: 'source states',
      object: 'A long summary sentence.',
      confidenceLevel: 'low' as const,
      citationSource: 'wikipedia_api',
      citationLabel: 'Wikipedia',
    },
  ];
  const live = liveRow([
    LIVE_CLAIM,
    { ...LIVE_CLAIM, id: 'claim_02', predicate: 'location', object: 'Greenwood District' },
  ]);
  assert.equal(claimCountRegressed(rebuiltOnly, live), true);
});

/*
 * A standing withdrawal decision blocks republishing even when canonical research and a fully
 * enriched candidate remain. Tests must use otherwise-eligible candidates so unrelated quality
 * failures cannot mask a missing withdrawal gate.
 */
/**
 * Prose long enough to clear the editorial band the publisher enforces, hedged and attributed the
 * way the owner ruling demanded. The fixtures must be publishable to be worth anything here, and
 * an unhedged accusation in a fixture is the very thing these records were withdrawn for.
 */
const sundownSummary = (place: string, county: string): string =>
  `${place} appears in the compiled sundown-town research literature, which gathers oral ` +
  `testimony, local newspaper notices and census population series for towns across ${county} ` +
  'and catalogs them by how strong the underlying documentation is. The compilation records ' +
  `${place} as a claim drawn from secondary accounts rather than a finding established by a ` +
  'primary municipal record, and the entry carries that qualification with it. Researchers ' +
  'working from the same series note that a population series alone cannot distinguish an ' +
  'exclusion policy from other causes of demographic change, so the entry is presented as a ' +
  'research lead and not as a conclusion about the town.';

const WITHDRAWN_CONTEXT =
  'The compilation this entry rests on is a research index, not an adjudication. Local histories ' +
  'and the town record would have to be read directly before any of this goes back in front of a ' +
  'reader, which is what the withdrawal ruling asked for.';

const withdrawnRow = (
  overrides: Partial<LandscapePublishRow> & Pick<LandscapePublishRow, 'id'>,
): LandscapePublishRow =>
  baseRow({
    lane: 'sundown-towns',
    kind: 'place',
    source_item_id: overrides.id,
    // An explicit enrichment confidence, the way a staged row carries one, so the assertions
    // below turn on the ruling rather than on how the confidence engine happens to score a
    // stand-in source host.
    payload: { historicalContext: WITHDRAWN_CONTEXT, enrichment: { confidence: 0.86 } },
    ...overrides,
  });

const WITHDRAWN_ROWS: readonly LandscapePublishRow[] = [
  withdrawnRow({
    id: 'sundown_crescent_springs_kentucky',
    display_name: 'Crescent Springs, Kentucky',
    summary: sundownSummary('Crescent Springs', 'Kenton County, Kentucky'),
    canonical_url: 'https://example.org/sundown-research/crescent-springs-ky',
    provenance: { sourceCity: 'Crescent Springs', sourceState: 'KY' },
    lat: 39.0439,
    lng: -84.5866,
  }),
  withdrawnRow({
    id: 'sundown_st_john_missouri',
    display_name: 'St. John, Missouri',
    summary: sundownSummary('St. John', 'St. Louis County, Missouri'),
    canonical_url: 'https://example.org/sundown-research/st-john-mo',
    provenance: { sourceCity: 'St. John', sourceState: 'MO' },
    lat: 38.7156,
    lng: -90.3562,
  }),
  withdrawnRow({
    id: 'nrhp-black-heritage-08000095',
    lane: 'nrhp-black-heritage',
    display_name: 'St. Agnes Cemetery',
    summary:
      'St. Agnes Cemetery in Menands, Albany County, New York was consecrated in 1867 and laid ' +
      'out in the rural cemetery style, with curving drives and mature plantings across roughly ' +
      '108 acres. It was listed on the National Register of Historic Places in 2008, and the ' +
      'nomination records its funerary art and landscape architecture alongside the veterans of ' +
      'the Civil War, the Spanish-American War and both World Wars buried there. The nomination ' +
      'is the document this entry rests on, and what it does and does not establish about the ' +
      "cemetery's place in Black history is the question the withdrawal ruling reopened.",
    canonical_url: 'https://npgallery.nps.gov/AssetDetail/NRIS/08000095',
    source_item_id: '08000095',
    provenance: {
      refnum: '08000095',
      sourceCity: 'Menands',
      sourceState: 'NY',
      sourceUrl: 'https://npgallery.nps.gov/AssetDetail/NRIS/08000095',
    },
    payload: {
      refnum: '08000095',
      listedDateSerial: '39506',
      areaOfSignificance: 'SOCIAL HISTORY; LANDSCAPE ARCHITECTURE; BLACK; ETHNIC HERITAGE-BLACK',
      historicalContext: WITHDRAWN_CONTEXT,
      enrichment: { confidence: 0.86 },
    },
    lat: 42.58824,
    lng: -73.97401,
  }),
];

const RETRACTION: CatalogDecisionRow = {
  entity_id: 'unused-in-these-assertions',
  decision: 'flag_for_retraction',
  reason: 'repo-eh9cp: owner ruling 2026-09-12',
};

/**
 * `catalogDecisionFromRow` with its undefined branch asserted away. The gate's input is an
 * exact optional property, so a `T | undefined` cannot be spread into it, and asserting here
 * keeps a fixture that stopped parsing from quietly turning into a gate that was never asked.
 */
const decisionFor = (row: CatalogDecisionRow): PublishCatalogDecision => {
  const decision = catalogDecisionFromRow(row);
  assert.ok(decision, `fixture decision "${row.decision}" should parse`);
  return decision;
};

/**
 * The control. Without it, every assertion below would also pass on a fixture the gate rejects
 * for some unrelated reason, and the test would prove nothing about the ruling.
 */
test('the three records withdrawn on 2026-09-13 are otherwise publishable', () => {
  for (const row of WITHDRAWN_ROWS) {
    const result = gateWithReviewedClaims({
      row,
      releaseId: 'rel_seed_001',
      generatedAt: '2026-09-13T00:00:00.000Z',
    });
    assert.equal(result.eligible, true, `${row.id} should be eligible with no decision standing`);
  }
});

test('an open flag_for_retraction keeps a withdrawn record out of a rebuild', () => {
  for (const row of WITHDRAWN_ROWS) {
    const result = gateWithReviewedClaims({
      row,
      releaseId: 'rel_seed_001',
      generatedAt: '2026-09-13T00:00:00.000Z',
      // Asserted under --republish, because a lane correction pass is precisely the run that
      // would have brought these back.
      allowRepublish: true,
      catalogDecision: decisionFor({ ...RETRACTION, entity_id: row.id }),
    });
    assert.equal(result.eligible, false, `${row.id} must not republish under a retraction`);
    if (result.eligible) return;
    assert.equal(result.reason, 'catalog_decision_retracted');
    assert.match(result.detail, /owner ruling/);
  }
});

/**
 * The ruling outranks the editorial checks. A withdrawn record whose summary is also too short
 * must not be reported as `summary_too_short`, which reads as "lengthen it and it publishes"
 * when the truth is that it must not publish at any length — and the run report's `retractedIds`
 * line would undercount if another check could claim the skip first. This is the live shape of
 * the NRHP record today: its landscape summary is 246 characters, under the publisher's floor.
 */
test('the withdrawal ruling outranks the editorial gates that would also skip the record', () => {
  const row = { ...WITHDRAWN_ROWS[2]!, summary: 'Too short to publish on its own.' };
  const withoutDecision = gateWithReviewedClaims({
    row,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-13T00:00:00.000Z',
    allowRepublish: true,
  });
  // The control: without the ruling this row really is skipped for the shorter-summary reason.
  assert.equal(withoutDecision.eligible, false);
  assert.equal(withoutDecision.eligible === false && withoutDecision.reason, 'summary_too_short');

  const withDecision = gateWithReviewedClaims({
    row,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-13T00:00:00.000Z',
    allowRepublish: true,
    catalogDecision: decisionFor({ ...RETRACTION, entity_id: row.id }),
  });
  assert.equal(withDecision.eligible, false);
  assert.equal(
    withDecision.eligible === false && withDecision.reason,
    'catalog_decision_retracted',
  );
});

test('buildArtifactsForEntry refuses to build rows for a withdrawn record', () => {
  const row = WITHDRAWN_ROWS[0]!;
  const entry = buildReleaseSourceFromLandscape(row);
  assert.ok(entry);
  // Straight to the builder, bypassing the gate: this is the call that produces the upsert rows,
  // so it has to refuse on its own rather than trusting a caller to have gated first.
  const built = buildArtifactsForEntry({
    entry: entry!,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-09-13T00:00:00.000Z',
    catalogDecision: decisionFor({ ...RETRACTION, entity_id: row.id }),
  });
  assert.equal(built.ok, false);
  if (built.ok) return;
  assert.match(built.detail, /catalog_decision_retracted/);
});

test('a lifted or advisory decision does not block a republish', () => {
  const row = WITHDRAWN_ROWS[0]!;
  for (const decision of ['clear_flag', 'needs_review'] as const) {
    const result = gateWithReviewedClaims({
      row,
      releaseId: 'rel_seed_001',
      generatedAt: '2026-09-13T00:00:00.000Z',
      catalogDecision: decisionFor({ ...RETRACTION, entity_id: row.id, decision }),
    });
    assert.equal(result.eligible, true, `${decision} must not act as a withdrawal`);
  }
});

test('catalogDecisionFromRow reads the standing verdict and refuses to guess', () => {
  assert.deepEqual(catalogDecisionFromRow(RETRACTION), {
    action: 'flag_for_retraction',
    reason: 'repo-eh9cp: owner ruling 2026-09-12',
  });
  // `reason` is nullable in ops.catalog_decisions; an absent one must not become "null".
  assert.deepEqual(catalogDecisionFromRow({ ...RETRACTION, reason: null }), {
    action: 'flag_for_retraction',
    reason: '',
  });
  assert.equal(catalogDecisionFromRow(undefined), undefined);
  assert.equal(catalogDecisionFromRow(null), undefined);
  assert.equal(catalogDecisionFromRow({ ...RETRACTION, decision: 'retract_maybe' }), undefined);
});

test('model self-confidence and entity-wide citations cannot bypass claim review, even on republish', () => {
  const row = enrichedRow({
    exact_in_release: true,
    payload: {
      ...enrichedRow().payload,
      confidence: 1,
      enrichment: { confidence: 1 },
      evidenceCitations: [{ sourceUrl: 'https://www.nps.gov/', quote: 'Gardner Bishop' }],
    },
  });
  for (const allowRepublish of [false, true]) {
    const result = gateLandscapePublishCandidate({
      row: { ...row, exact_in_release: allowRepublish },
      releaseId: 'test',
      generatedAt: '2026-01-01T00:00:00Z',
      allowRepublish,
    });
    assert.equal(result.eligible, false);
    if (!result.eligible) assert.equal(result.reason, 'claim_assessment_required');
  }
});

test('independent review of every exact claim permits publication and keeps canonical ids', () => {
  const row = enrichedRow();
  const reviewedClaims = reviewedClaimsFor(row);
  const result = gateLandscapePublishCandidate({
    row,
    reviewedClaims,
    releaseId: 'test',
    generatedAt: '2026-01-01T00:00:00Z',
  });
  assert.ok(result.eligible);
  assert.equal(result.reviewBasis, 'independent_review');
  assert.equal(result.entry.claims?.[0]?.id, reviewedClaims[0]?.claimId);
});

test('an uncalibrated numeric interval neither blocks nor authorizes independently reviewed claims', () => {
  const row = enrichedRow({ exact_in_release: true });
  const result = gateLandscapePublishCandidate({
    row,
    reviewedClaims: reviewedClaimsFor(row, 0.7),
    releaseId: 'test',
    generatedAt: '2026-01-01T00:00:00Z',
    allowRepublish: true,
  });
  assert.ok(result.eligible);
  assert.equal(result.reviewBasis, 'independent_review');
});
