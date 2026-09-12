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
  gateLandscapePublishCandidate,
  INCREMENTAL_PUBLISH_CONFIDENCE_FLOOR,
  incrementalPublishProvenancePatch,
  jurisdictionFromPlace,
  jurisdictionFromProvenance,
  liveClaimConfidence,
  MERGED_EVIDENCE_QUOTE_MAX_CHARS,
  parseCanonicalStatusSnapshot,
  toReleaseEntityRow,
  toSearchIndexRow,
  visitOverrideFromCanonicalRow,
  type CanonicalVisitRow,
  type LandscapePublishRow,
} from './incremental-publish.ts';
import {
  buildReleaseEntityArtifacts,
  deriveCatalogEntityStatus,
  type PublicVisit,
} from '@repo/domain';
import { mapPostgresSearchIndexRow } from '@repo/schemas';

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
  const result = gateLandscapePublishCandidate({
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
  const result = gateLandscapePublishCandidate({
    row: reviewed,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  // Passes the person hold; may still fail later gates, but not person_kind.
  if (!result.eligible) assert.notEqual(result.reason, 'person_kind');
});

test('gateLandscapePublishCandidate rejects incomplete personReview markers', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow({ kind: 'person', payload: { personReview: { approved: true } } }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'person_kind');
});

test('gateLandscapePublishCandidate rejects greenbook lane', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow({ lane: 'greenbook' }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'greenbook_lane');
});

test('gateLandscapePublishCandidate rejects already-in-public rows', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow({ exact_in_release: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'already_in_public');
});

test('gateLandscapePublishCandidate allowRepublish lets an already-published row past already_in_public', () => {
  const result = gateLandscapePublishCandidate({
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
  const result = gateLandscapePublishCandidate({
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
  const result = gateLandscapePublishCandidate({
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
 * repo-b4ad — ADMISSION vs REGRESSION. All four tests below use the SAME shallow candidate, the
 * one the test directly above rejects. What changes is whether the record is already live and
 * what is published for it, because that is the only thing that should change the answer.
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
  const result = gateLandscapePublishCandidate({
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

  const result = gateLandscapePublishCandidate({
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

  const result = gateLandscapePublishCandidate({
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
  const result = gateLandscapePublishCandidate({
    row: nrhpRow({ exact_in_release: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'template_only');
});

/**
 * repo-8dlu — name_overlap, same admission/regression split. The overlap flag is identical in all
 * three cases; only whether the row is already live changes the answer.
 */
test('name_overlap still blocks a NEW candidate whose name collides with a live entity', () => {
  const result = gateLandscapePublishCandidate({
    row: enrichedRow({ name_overlap: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'name_overlap');
});

test('name_overlap still blocks a colliding candidate that is NOT already live, even on a republish run', () => {
  const result = gateLandscapePublishCandidate({
    row: enrichedRow({ name_overlap: true, exact_in_release: false }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'name_overlap');
});

test('name_overlap does not block an in-place correction of a row already live under its own id', () => {
  const result = gateLandscapePublishCandidate({
    row: enrichedRow({ name_overlap: true, exact_in_release: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
  });
  assert.equal(result.eligible, true);
});

/** A republish admitted by the regression clause must still read as thin (repo-vymq). */
test('a regression-clause republish publishes researchCoverage=minimal', () => {
  const row = nrhpRow({ exact_in_release: true });
  const result = gateLandscapePublishCandidate({
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
  // Same passthrough gap as historicalContext, for the rest of the WS4 (repo-n7p6.4) harness's
  // output — never wired in before because nothing wrote these fields onto a landscape row.
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
  // A cohort-adopted seed record's related entity ids have to survive a republish the same way
  // topicIds/keywords do, or adopting the row silently drops them (repo-n7p6, mentionedEntityIds
  // used to be hardcoded to []).
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

test('parseCanonicalStatusSnapshot maps bb_canonical row fields', () => {
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
 * `bb_canonical.entity_visit`/`entity_locations`. Before `visitOverride` was threaded through the
 * gate and the artifact build, a republish of an already-live, already-enriched record silently
 * dropped that block; this proves the same republish now carries it through when the caller
 * supplies the canonical visit row it loaded, and confirms it does NOT appear without one.
 */
test('a lane republish preserves phone/website/hours/street via visitOverride from canonical tables', () => {
  const row = enrichedRow();
  const visitOverride = visitOverrideFromCanonicalRow(row, canonicalVisitRow());
  assert.ok(visitOverride);

  const gateWithoutOverride = gateLandscapePublishCandidate({
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

  const gateWithOverride = gateLandscapePublishCandidate({
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
  const gate = gateLandscapePublishCandidate({
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
  const result = gateLandscapePublishCandidate({
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
  assert.ok(Array.isArray(row.related));
  assert.deepEqual(row.related, []);
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
 * repo-fbjr — the documents the sweep actually read become claims that cite them.
 *
 * Before this, an enriched record published citing only its registry index row: the nomination
 * form every sentence came from appeared nowhere in the projection, so the depth gate saw no
 * evidence beyond the index and researchCoverage counted one document for a researched record.
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
  // Not 'medium'. Wikipedia does not corroborate at all — `claim-corroborate` puts a Wikipedia
  // claim at `low`, and the record tier drops its lineage from the corroborating count outright.
  // The old expectation here said "tier2 corroborates", which is the belief that carried 335
  // records to grade A (repo-goyut, repo-hqwt9).
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
 * A landscape row from a research case whose canonical document (nps.gov) is also the
 * provenance `sourceUrl` — the shape a research-case promotion produces when the canonical link
 * IS the source the record was built from. `corroboratingSourcesForLandscape` no longer deletes
 * that URL out of the corroboration pool it just built.
 */
const researchCaseRow = (overrides: Partial<LandscapePublishRow> = {}): LandscapePublishRow =>
  baseRow({
    id: 'ent_research_case_probe',
    lane: 'research-cases',
    display_name: 'Nicodemus AME Church',
    summary:
      'Nicodemus AME Church is a historic congregation in Nicodemus, Kansas, documented by the ' +
      'National Park Service as part of the Nicodemus National Historic Site. The congregation ' +
      'was organized by formerly enslaved settlers who founded the town in 1877, and the church ' +
      'building itself has stood as a landmark of the settlement since the nineteenth century. ' +
      'A roadside historical marker placed by the local historical society also records the ' +
      "congregation's founding and its role in the town's early religious life, noting that the " +
      'building has hosted continuous worship since its construction.',
    lat: 39.75,
    lng: -99.62,
    canonical_url: 'https://www.nps.gov/nico/learn/historyculture/ame-church.htm',
    provenance: { sourceUrl: 'https://www.nps.gov/nico/learn/historyculture/ame-church.htm' },
    payload: {},
    ...overrides,
  });

/**
 * repo defect fix: a claim built from a second document (the marker database) used to lose the
 * record's own canonical government page from its corroboration set, because
 * `corroboratingSourcesForLandscape` deleted `canonical_url` out of the pool it had just built —
 * a second self-corroboration guard on top of the per-claim filter `minClaimConfidence` already
 * applies. Measured live on ent_research_case_20260902_nicodemus-ame-church: canonical nps.gov +
 * evidence hmdb.org + wikipedia scored 0.720 (below the 0.75 floor) because the hmdb claim's only
 * remaining corroborator was the Wikipedia bridge, which counts zero lineages. With the canonical
 * document back in the pool, the same claim is corroborated by a second real authority
 * (national-park-service) and clears the floor.
 */
test("gateLandscapePublishCandidate: a claim from a second document is corroborated by the record's own canonical government page", () => {
  const row = researchCaseRow({
    payload: {
      evidenceCitations: [
        {
          sourceUrl: 'https://www.hmdb.org/m.asp?m=12345',
          title: 'Nicodemus AME Church historical marker',
          sourceTier: 'tier2',
          quote: 'the congregation organized this church soon after the town was founded in 1877',
        },
      ],
    },
  });
  const result = gateLandscapePublishCandidate({
    row,
    releaseId: 'rel_test',
    generatedAt: '2026-09-09T00:00:00.000Z',
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.ok(
    result.confidence >= INCREMENTAL_PUBLISH_CONFIDENCE_FLOOR,
    `expected confidence >= floor, got ${result.confidence}`,
  );
  assert.equal(result.confidence, 0.79);
});

/**
 * A canonical page and its only evidence citation from the SAME authority (two different
 * hmdb.org marker pages) still collapse onto one lineage — `resolveSourceLineage` groups by
 * issuing authority, not by exact URL, so this is unaffected by removing the delete guard. A
 * record with two pages from one institution gains nothing from counting both.
 */
test('gateLandscapePublishCandidate: canonical and evidence from the same authority still fail the floor (one lineage)', () => {
  const row = researchCaseRow({
    canonical_url: 'https://www.hmdb.org/m.asp?m=11111',
    provenance: { sourceUrl: 'https://www.hmdb.org/m.asp?m=11111' },
    payload: {
      evidenceCitations: [
        {
          sourceUrl: 'https://www.hmdb.org/m.asp?m=12345',
          title: 'Nicodemus AME Church historical marker',
          sourceTier: 'tier2',
          quote: 'the congregation organized this church soon after the town was founded in 1877',
        },
      ],
    },
  });
  const result = gateLandscapePublishCandidate({
    row,
    releaseId: 'rel_test',
    generatedAt: '2026-09-09T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (result.eligible) return;
  assert.equal(result.reason, 'confidence_below_floor');
  assert.equal(result.detail, 'confidence 0.720 < floor 0.75');
});

/**
 * repo-2t04.17 — ADMISSION vs REGRESSION for confidence, same shape as the depth clause above.
 * Reuses the exact fixture from the test just above (0.720, below the 0.75 floor) so the only
 * variable across these four tests is whether/what live state is supplied.
 */
test('confidence gate still rejects a low-scoring candidate for a record that is NOT live', () => {
  const row = researchCaseRow({
    canonical_url: 'https://www.hmdb.org/m.asp?m=11111',
    provenance: { sourceUrl: 'https://www.hmdb.org/m.asp?m=11111' },
    payload: {
      evidenceCitations: [
        {
          sourceUrl: 'https://www.hmdb.org/m.asp?m=12345',
          title: 'Nicodemus AME Church historical marker',
          sourceTier: 'tier2',
          quote: 'the congregation organized this church soon after the town was founded in 1877',
        },
      ],
    },
  });
  const result = gateLandscapePublishCandidate({
    row,
    releaseId: 'rel_test',
    generatedAt: '2026-09-09T00:00:00.000Z',
    allowRepublish: true,
    liveConfidence: 0.72, // irrelevant — row.exact_in_release is false, so this is not a republish
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'confidence_below_floor');
});

test('confidence gate lets a candidate that scores no worse replace an already-live record below the floor', () => {
  const row = researchCaseRow({
    canonical_url: 'https://www.hmdb.org/m.asp?m=11111',
    provenance: { sourceUrl: 'https://www.hmdb.org/m.asp?m=11111' },
    exact_in_release: true,
    payload: {
      evidenceCitations: [
        {
          sourceUrl: 'https://www.hmdb.org/m.asp?m=12345',
          title: 'Nicodemus AME Church historical marker',
          sourceTier: 'tier2',
          quote: 'the congregation organized this church soon after the town was founded in 1877',
        },
      ],
    },
  });
  const result = gateLandscapePublishCandidate({
    row,
    releaseId: 'rel_test',
    generatedAt: '2026-09-09T00:00:00.000Z',
    allowRepublish: true,
    liveConfidence: 0.72, // what is currently public scores the same — not a regression
  });
  assert.equal(result.eligible, true);
});

test('confidence gate refuses to replace an already-live record with a candidate that scores WORSE', () => {
  const row = researchCaseRow({
    canonical_url: 'https://www.hmdb.org/m.asp?m=11111',
    provenance: { sourceUrl: 'https://www.hmdb.org/m.asp?m=11111' },
    exact_in_release: true,
    payload: {
      evidenceCitations: [
        {
          sourceUrl: 'https://www.hmdb.org/m.asp?m=12345',
          title: 'Nicodemus AME Church historical marker',
          sourceTier: 'tier2',
          quote: 'the congregation organized this church soon after the town was founded in 1877',
        },
      ],
    },
  });
  const result = gateLandscapePublishCandidate({
    row,
    releaseId: 'rel_test',
    generatedAt: '2026-09-09T00:00:00.000Z',
    allowRepublish: true,
    liveConfidence: 0.8, // what is currently public already clears the floor
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'confidence_below_floor');
});

/**
 * The fail-closed default. A caller that never loaded live state gets the strict admission test,
 * so forgetting to pass `liveConfidence` cannot silently widen what publishes — same guarantee
 * `liveDepth`'s omission gives above.
 */
test('confidence gate falls back to the strict admission test when live confidence is unknown', () => {
  const row = researchCaseRow({
    canonical_url: 'https://www.hmdb.org/m.asp?m=11111',
    provenance: { sourceUrl: 'https://www.hmdb.org/m.asp?m=11111' },
    exact_in_release: true,
    payload: {
      evidenceCitations: [
        {
          sourceUrl: 'https://www.hmdb.org/m.asp?m=12345',
          title: 'Nicodemus AME Church historical marker',
          sourceTier: 'tier2',
          quote: 'the congregation organized this church soon after the town was founded in 1877',
        },
      ],
    },
  });
  const result = gateLandscapePublishCandidate({
    row,
    releaseId: 'rel_test',
    generatedAt: '2026-09-09T00:00:00.000Z',
    allowRepublish: true,
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'confidence_below_floor');
});

/**
 * `liveClaimConfidence` must score the SAME evidence the same way `minClaimConfidence` does for a
 * candidate — otherwise a depth verdict and a confidence verdict on one live row could disagree
 * with what that row would score as a fresh candidate. Reuses the claims `buildReleaseSourceFromLandscape`
 * produces for the 0.720 fixture above, repackaged as a `LivePublishedRow`.
 */
test('liveClaimConfidence scores a live row the same way a candidate with identical evidence would score', () => {
  const row = researchCaseRow({
    canonical_url: 'https://www.hmdb.org/m.asp?m=11111',
    provenance: { sourceUrl: 'https://www.hmdb.org/m.asp?m=11111' },
    payload: {
      evidenceCitations: [
        {
          sourceUrl: 'https://www.hmdb.org/m.asp?m=12345',
          title: 'Nicodemus AME Church historical marker',
          sourceTier: 'tier2',
          quote: 'the congregation organized this church soon after the town was founded in 1877',
        },
      ],
    },
  });
  const entry = buildReleaseSourceFromLandscape(row);
  assert.ok(entry);
  const liveRow = { summary: row.summary, claims: entry!.claims, projection: {} };
  assert.equal(liveClaimConfidence(liveRow), 0.72);
});

test('liveClaimConfidence returns 0 for a live row with no claims, never undefined or NaN', () => {
  assert.equal(liveClaimConfidence({ summary: 'x', claims: [], projection: {} }), 0);
});

/**
 * A row with only its own canonical citation — no evidence documents, no duplicated sourceUrl to
 * corroborate from — is unaffected by removing the delete guard: `minClaimConfidence` already
 * filters a claim's own citationHref out of its corroboration sources
 * (`.filter((url) => url !== citationHref)`), so the index claim never counted itself before this
 * fix and does not start counting itself now. Depth is cleared here via `historicalContext`
 * rather than a second document, since a canonical-only row has no independent source.
 */
test('gateLandscapePublishCandidate: the index claim still does not count itself (canonical only)', () => {
  const row = researchCaseRow({
    provenance: {},
    payload: {
      historicalContext:
        'The congregation organized this church soon after formerly enslaved settlers founded ' +
        'Nicodemus in 1877.',
    },
  });
  const result = gateLandscapePublishCandidate({
    row,
    releaseId: 'rel_test',
    generatedAt: '2026-09-09T00:00:00.000Z',
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  // Unchanged from before the fix: a lone government citation, one lineage, no corroborator.
  assert.equal(result.confidence, 0.77);
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
  const gate = gateLandscapePublishCandidate({
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
      confidenceTier: 'unrated',
    },
    'dqcjq',
  );
  assert.equal(
    Object.hasOwn(row.facets as Record<string, unknown>, 'jurisdictionState'),
    false,
    'a whitespace-only jurisdiction must not be written',
  );
});
