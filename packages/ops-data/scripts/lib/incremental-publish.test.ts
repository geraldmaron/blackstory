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
  incrementalPublishProvenancePatch,
  jurisdictionFromProvenance,
  parseCanonicalStatusSnapshot,
  toReleaseEntityRow,
  type LandscapePublishRow,
} from './incremental-publish.ts';
import { buildReleaseEntityArtifacts } from '@repo/domain';

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
    'with source material preserved through the historic-preservation inventory.',
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

test('jurisdictionFromProvenance maps DC to full label', () => {
  assert.equal(
    jurisdictionFromProvenance({ sourceCity: 'Washington', sourceState: 'DC' }),
    'Washington, District of Columbia',
  );
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
      'a documented site of African American historical importance.',
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

test('buildArtifactsForEntry publishes canonical deceased even when personReview says living', () => {
  const reviewed = baseRow({
    kind: 'person',
    summary:
      'A'.repeat(220) +
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
  assert.equal(nomination!.confidenceLevel, 'high', 'tier1 is authoritative');
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
  assert.equal(wiki!.confidenceLevel, 'medium', 'tier2 corroborates, it does not authorize');
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
