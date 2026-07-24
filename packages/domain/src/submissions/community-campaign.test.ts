/**
 * Community Knowledge Holder Partnership intake tests.
 *
 * Covers: campaign-brief generation, submission scoring routing to the human-gated
 * `relevance_review` lane, and the obscurity low-authority boost applying to
 * community_oral / self_published submissions. All fixtures inline (synthetic people —
 * no real individuals), plus a shape check on the seeded priority-county registry.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCommunityCampaignBrief,
  communitySubmissionToDiscoveryCandidate,
  loadCommunityHolderRegistry,
  parseCommunityHolderRegistry,
  scoreCommunitySubmission,
  toCommunitySubmissionPayload,
  COMMUNITY_HOLDER_TYPES,
  COMMUNITY_PARTNERSHIP_CARE_POLICY,
  COMMUNITY_SUBMISSION_FIELD_SPECS,
  type CommunityCampaignCounty,
  type CommunityKnowledgeHolder,
  type CommunitySubmission,
} from './community-campaign.js';
import { isLowAuthoritySourceTier } from '../relevance/gates.js';

const FIXED_NOW = '2026-07-24T12:00:00.000Z';

const COUNTY: CommunityCampaignCounty = {
  countyName: 'Dallas County',
  stateCode: 'AL',
  fipsCode: '01047',
};

const HOLDERS: readonly CommunityKnowledgeHolder[] = [
  {
    holderType: 'county_historical_society',
    displayLabel: 'County Historical Society',
    classification: 'self_published',
  },
  {
    holderType: 'local_naacp_chapter',
    displayLabel: 'Local NAACP Chapter',
    classification: 'community_oral',
  },
  {
    holderType: 'black_church_archive',
    displayLabel: 'Black Church Archive',
    classification: 'community_oral',
  },
];

/** Synthetic submission — fictional person, cited to a church minute book. */
function citedSubmission(overrides: Partial<CommunitySubmission> = {}): CommunitySubmission {
  return {
    schemaVersion: 'community-submission.v1',
    submissionId: 'sub_test_0001',
    campaignId: 'camp_community_AL_dallas_county',
    holderType: 'black_church_archive',
    county: COUNTY,
    personName: 'Ezella Mae Carter',
    role: 'midwife and church mother',
    place: 'Shiloh Baptist Church, Selmont community',
    year: '1934',
    sourceCitation: 'Shiloh Baptist Church minute book, vol. 2 (1930–1941), p. 87',
    subjectLivingStatus: 'deceased',
    submittedAt: FIXED_NOW,
    ...overrides,
  };
}

// --- Brief generation -------------------------------------------------------------------

test('buildCommunityCampaignBrief produces a structured guide with all six intake fields', () => {
  const brief = buildCommunityCampaignBrief(COUNTY, HOLDERS);

  assert.equal(brief.schemaVersion, 'community-campaign-brief.v1');
  assert.equal(brief.campaignId, 'camp_community_AL_dallas_county');
  assert.equal(brief.holders.length, 3);

  const fieldNames = brief.fields.map((spec) => spec.field);
  assert.deepEqual(fieldNames, [
    'personName',
    'role',
    'place',
    'year',
    'sourceCitation',
    'oralHistoryRef',
  ]);
  // Identity fields are required; evidence fields are conditionally required (at least one
  // of citation/oral ref enforced at scoring time).
  for (const required of ['personName', 'role', 'place'] as const) {
    assert.equal(brief.fields.find((spec) => spec.field === required)?.required, true);
  }

  // Extra-care policy mirrors the curated-feeds pattern and never allows solo publish.
  assert.equal(brief.care.cannotPublishAlone, true);
  assert.equal(brief.care.quarantineFirst, true);
  assert.equal(brief.care.preferCatalogMatch, true);
  assert.equal(brief.care.livingPersonProtections, true);
  assert.ok(brief.care.operatorCaution.length > 0);
  assert.ok(brief.privacyNotice.includes('treat them as living'));
});

test('buildCommunityCampaignBrief rejects empty holders and non-low-authority tiers', () => {
  assert.throws(() => buildCommunityCampaignBrief(COUNTY, []), /at least one identified/);
  assert.throws(
    () =>
      buildCommunityCampaignBrief(COUNTY, [
        {
          holderType: 'county_historical_society',
          displayLabel: 'County Historical Society',
          // Community holders must never claim archival authority.
          classification: 'primary_archival' as never,
        },
      ]),
    /low-authority tier/,
  );
});

// --- Submission scoring routes to relevance_review --------------------------------------

test('scoreCommunitySubmission always routes to human relevance_review and never include', () => {
  const assessment = scoreCommunitySubmission(citedSubmission(), {
    catalogTitles: ['Rosa Parks', 'Buffalo Soldiers', 'Harriet Tubman'],
    assessedAt: FIXED_NOW,
  });

  assert.equal(assessment.schemaVersion, 'community-submission-assessment.v1');
  assert.equal(assessment.routing.targetState, 'relevance_review');
  assert.equal(assessment.routing.queue, 'relevance');
  assert.equal(assessment.cannotPublishAlone, true);

  // candidate_only outcome makes `include` structurally unreachable at intake time.
  assert.equal(assessment.candidate.signals.outcome, 'candidate_only');
  assert.notEqual(assessment.relevance.decision, 'include');
  assert.ok(['supporting_context', 'exclude'].includes(assessment.relevance.decision));

  // A cited, dated, placed submission should still register as a real research lead.
  assert.equal(assessment.relevance.decision, 'supporting_context');
  assert.equal(assessment.livingPersonPosture, 'documented_deceased');
});

test('unknown living status is treated as living', () => {
  const assessment = scoreCommunitySubmission(
    citedSubmission({ submissionId: 'sub_test_0002', subjectLivingStatus: undefined }),
  );
  assert.equal(assessment.livingPersonPosture, 'treat_as_living');
});

test('submission without citation or oral-history reference is rejected before scoring', () => {
  const bare = citedSubmission({ submissionId: 'sub_test_0003' });
  const { sourceCitation: _drop, ...rest } = bare;
  assert.throws(
    () => scoreCommunitySubmission(rest as CommunitySubmission),
    /source citation or an oral history reference/,
  );
});

// --- Obscurity low-authority boost -------------------------------------------------------

test('obscurity low-authority boost applies to community_oral and self_published', () => {
  for (const classification of ['community_oral', 'self_published'] as const) {
    const assessment = scoreCommunitySubmission(
      citedSubmission({ submissionId: `sub_test_${classification}`, classification }),
      { catalogTitles: ['Rosa Parks', 'Martin Luther King Jr.'], assessedAt: FIXED_NOW },
    );
    const boost = assessment.obscurity.factors.find(
      (factor) => factor.factor === 'low_authority_boost',
    );
    assert.ok(boost, 'low_authority_boost factor present');
    assert.equal(boost.raw, 1, `${classification} gets the low-authority boost`);
    assert.ok(boost.weighted > 0);
    assert.equal(assessment.obscurity.methodologyVersion, 'obscurity.v1');
    assert.equal(assessment.obscurity.disclaimerId, 'methodology_obscurity_heuristic_v1');
  }
});

test('minted candidate carries low-authority classification and community provenance', () => {
  const candidate = communitySubmissionToDiscoveryCandidate(citedSubmission());
  assert.equal(isLowAuthoritySourceTier(candidate.adapterRecord.classification), true);
  assert.equal(candidate.adapterRecord.provenance.adapterId, 'community-partnership');
  assert.equal(candidate.ingestMode, 'api');
  // Place-connected: city + region + state hints all attached.
  assert.deepEqual(
    candidate.geographicHints.map((hint) => hint.kind),
    ['city', 'region', 'state'],
  );
});

// --- Intake payload mirrors api-submissions shape ----------------------------------------

test('toCommunitySubmissionPayload composes a contribution-kind SubmissionInput shape', () => {
  const payload = toCommunitySubmissionPayload(citedSubmission());
  assert.equal(payload.kind, 'contribution');
  assert.ok(payload.title.startsWith('Community lead:'));
  assert.ok(payload.statement.includes('Person name: Ezella Mae Carter'));
  assert.ok(payload.statement.includes('Source citation:'));
  assert.ok(Array.isArray(payload.sourceUrls));
});

// --- Seeded registry fixture --------------------------------------------------------------

test('priority-county holder registry loads with ≥3 role-based holder types per county', () => {
  const registry = loadCommunityHolderRegistry();
  assert.equal(registry.schemaVersion, 'community-holder-registry.v1');
  assert.ok(registry.counties.length >= 3);
  for (const county of registry.counties) {
    assert.ok(county.holders.length >= 3, `${county.countyName} has ≥3 holder types`);
    for (const holder of county.holders) {
      assert.ok(
        (COMMUNITY_HOLDER_TYPES as readonly string[]).includes(holder.holderType),
        'holder type is role-based',
      );
      assert.equal(isLowAuthoritySourceTier(holder.classification), true);
      // Role-based placeholders only — labels must never look like personal names.
      assert.match(
        holder.displayLabel,
        /Society|Chapter|Archive|Faculty|Library|Circle|Records|Organization/,
      );
    }
    // Registry counties can seed real briefs directly.
    const brief = buildCommunityCampaignBrief(
      { countyName: county.countyName, stateCode: county.stateCode },
      county.holders,
    );
    assert.equal(brief.fields.length, COMMUNITY_SUBMISSION_FIELD_SPECS.length);
  }
});

test('parseCommunityHolderRegistry rejects malformed registries', () => {
  assert.throws(() => parseCommunityHolderRegistry(null), /must be an object/);
  assert.throws(
    () => parseCommunityHolderRegistry({ schemaVersion: 'community-holder-registry.v2' }),
    /Unsupported/,
  );
  assert.throws(
    () =>
      parseCommunityHolderRegistry({
        schemaVersion: 'community-holder-registry.v1',
        description: 'too few holders',
        counties: [
          {
            countyName: 'Test County',
            stateCode: 'AL',
            holders: [
              {
                holderType: 'black_church_archive',
                displayLabel: 'Black Church Archive',
                classification: 'community_oral',
              },
            ],
          },
        ],
      }),
    /at least 3 holder types/,
  );
});

test('care policy default classification stays low-authority', () => {
  assert.equal(
    isLowAuthoritySourceTier(COMMUNITY_PARTNERSHIP_CARE_POLICY.defaultClassification),
    true,
  );
});
