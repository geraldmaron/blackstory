/**
 * Fixture-first tests for the Oral History Pipeline discovery campaign.
 *
 * Proves: transcript mentions become private discovery candidates, obscurity is attached and
 * boosted for no-identifier oral-history subjects, cited primary-source links harvest into
 * authority follow-ups, residential precision is withheld, the shipped seed is real, and the
 * discovery publish guard holds — all with inline fixtures and no network I/O.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ORAL_HISTORY_ADAPTER_ID,
  ORAL_HISTORY_SOURCE_CLASS,
  withholdResidentialPrecision,
  type OralHistoryAdapter,
  type OralHistoryCollection,
  type OralHistoryInterview,
  type OralHistoryMention,
  type OralHistorySource,
} from '../adapters/oral-history/index.js';
import { assertDiscoveryCannotPublish } from './guard.js';
import { assertCampaignCannotPublish } from './campaign-runner.js';
import {
  ORAL_HISTORY_CAMPAIGN_KIND,
  loadOralHistoryCollectionSeed,
  runOralHistoryCampaign,
} from './oral-history-campaign.js';

const FIXED_NOW = '2026-07-24T12:00:00.000Z';

const INLINE_SOURCES: readonly OralHistorySource[] = [
  {
    id: 'test-crhp',
    registryEntryId: 'reg_oral_history_test_crhp',
    sourceId: 'src_oral_history_test_crhp',
    organizationId: 'org_test_crhp',
    displayName: 'Test Civil Rights Oral History Collection',
    institution: 'Test Folklife Center',
    homepageUrl: 'https://example.org/crhp/',
    sourceClass: 'first-person-or-oral-history',
    classification: 'community_oral',
    collections: [
      {
        sourceId: 'src_oral_history_test_crhp',
        collectionId: 'test-crhp',
        title: 'Test Civil Rights History Project',
        institution: 'Test Folklife Center',
        collectionUrl: 'https://example.org/crhp/collection/',
      },
    ],
  },
];

const INTERVIEWS: readonly OralHistoryInterview[] = [
  {
    collectionId: 'test-crhp',
    interviewId: 'afc-2026-001',
    title: 'Interview with a Perry County freedom-school volunteer',
    interviewUrl: 'https://example.org/crhp/items/afc-2026-001/',
    narratorName: 'Deacon Ellis Boykin',
    interviewDate: '2011-06-14',
    summary: 'Freedom school and church organizing in Perry County, Alabama.',
    transcriptText:
      'We held the freedom school in the church basement in Marion, AL. Mother Ozella ' +
      'Greene hosted the quilting circle that raised the school fund. The NPS wrote up the ' +
      'church later, see https://www.nps.gov/places/test-church.htm and the county study at ' +
      'https://www.loc.gov/item/test-county-study/ for the records.',
    narratorLivingStatus: 'deceased',
  },
];

/**
 * Two person mentions: one with NO trusted identifiers (the classic oral-history subject) and
 * one already carrying trusted identifiers. Titles are chosen so the identified subject's
 * tokens appear in the catalog corpus (low rarity) while the no-identifier subject stays rare.
 */
const MENTIONS: readonly OralHistoryMention[] = [
  {
    kind: 'person',
    name: "Mother Ozella Greene, quilting-circle host, Gee's Bend",
    contextSnippet:
      'Narrator credits Mother Ozella Greene with hosting the quilting circle that funded the freedom school.',
    placeHint: 'Marion, AL',
    timePeriod: '1963/1965',
    livingStatus: 'unknown',
    citedUrls: ['https://www.nps.gov/places/test-church.htm'],
  },
  {
    kind: 'person',
    name: 'Selma voting rights march organizer',
    contextSnippet: 'Narrator describes the Selma voting rights march organizer visiting.',
    placeHint: 'Selma, AL',
    timePeriod: '1965',
    livingStatus: 'deceased',
    identifiers: { wikidata: 'Q000001', viaf: '0000001' },
  },
  {
    kind: 'place',
    name: 'Shiloh Missionary Baptist Church basement freedom school',
    contextSnippet:
      'The freedom school met in the church basement; the deacon kept the attendance book. Narrator lived at 411 Maple Street back then.',
    placeHint: 'Perry County, Alabama',
    timePeriod: '1963/1965',
  },
];

const CATALOG_TITLES: readonly string[] = [
  'Rosa Parks',
  'Martin Luther King Jr.',
  'Selma voting rights march',
  'Selma to Montgomery marchers and organizers',
];

function inlineAdapter(): OralHistoryAdapter {
  return {
    adapterId: ORAL_HISTORY_ADAPTER_ID,
    listInterviews(collection: OralHistoryCollection) {
      return collection.collectionId === 'test-crhp' ? INTERVIEWS : [];
    },
    extractMentions(transcript) {
      return transcript.interview.interviewId === 'afc-2026-001' ? MENTIONS : [];
    },
  };
}

async function runInlineCampaign() {
  return runOralHistoryCampaign({
    adapter: inlineAdapter(),
    sources: INLINE_SOURCES,
    catalogTitles: CATALOG_TITLES,
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });
}

test('campaign extracts transcript mentions into private discovery candidates', async () => {
  const result = await runInlineCampaign();

  assert.equal(result.kind, ORAL_HISTORY_CAMPAIGN_KIND);
  assert.equal(result.adapterId, ORAL_HISTORY_ADAPTER_ID);
  assert.deepEqual(result.sourceIds, ['src_oral_history_test_crhp']);
  assert.deepEqual(result.collectionIds, ['test-crhp']);
  assert.equal(result.yield.survivors, 3, 'expected all three mentions to survive');
  assert.equal(result.ranked.length, result.yield.survivors);

  for (const candidate of result.campaign.candidates) {
    assert.equal(candidate.adapterRecord.provenance.adapterId, ORAL_HISTORY_ADAPTER_ID);
    assert.equal(candidate.adapterRecord.classification, 'community_oral');
    const payload = candidate.adapterRecord.payload as { interviewId?: string };
    assert.equal(payload.interviewId, 'afc-2026-001');
  }

  const kinds = new Set(
    result.ranked.map((lead) => lead.mentionKind).filter((kind) => kind !== undefined),
  );
  assert.deepEqual([...kinds].sort(), ['person', 'place']);
});

test('obscurity is attached and no-identifier oral-history subjects score high', async () => {
  const result = await runInlineCampaign();

  for (const lead of result.ranked) {
    assert.equal(lead.obscurity.methodologyVersion, 'obscurity.v1');
    assert.ok(lead.obscurity.score >= 0 && lead.obscurity.score <= 1);
    assert.equal(lead.obscurity.candidateId, lead.candidateId);
  }
  // Ranked descending by obscurity score.
  for (let i = 1; i < result.ranked.length; i += 1) {
    assert.ok(result.ranked[i - 1]!.obscurity.score >= result.ranked[i]!.obscurity.score);
  }
  assert.equal(result.disclaimer.id, 'methodology_obscurity_heuristic_v1');

  const noIdLead = result.ranked.find((lead) => lead.title?.includes('Ozella Greene'))!;
  const identifiedLead = result.ranked.find((lead) => lead.title?.includes('Selma'))!;
  assert.ok(noIdLead && identifiedLead);

  const sparseFactor = (lead: typeof noIdLead) =>
    lead.obscurity.factors.find((f) => f.factor === 'identifier_sparseness')!;
  // No trusted identifiers → full identifierSparseness boost.
  assert.equal(sparseFactor(noIdLead).raw, 1);
  assert.ok(sparseFactor(noIdLead).weighted > 0);
  // Two trusted identifiers (wikidata + viaf) → zero sparseness.
  assert.equal(sparseFactor(identifiedLead).raw, 0);
  // The unidentified local subject out-scores the catalog-adjacent identified one.
  assert.ok(noIdLead.obscurity.score > identifiedLead.obscurity.score);
  // community_oral is a low-authority tier → discovery boost applies.
  const authorityFactor = noIdLead.obscurity.factors.find(
    (f) => f.factor === 'low_authority_boost',
  )!;
  assert.equal(authorityFactor.raw, 1);
});

test('authority harvest picks up primary-source links cited in transcripts', async () => {
  const result = await runInlineCampaign();

  assert.ok(result.authorityFollowUps.length >= 1, 'expected authority follow-ups');
  const hosts = new Set(result.authorityFollowUps.map((lead) => lead.host));
  assert.ok(hosts.has('nps.gov') || hosts.has('loc.gov'));
  for (const lead of result.authorityFollowUps) {
    assert.equal(lead.reason, 'authority_host_allowlist');
  }
  const total = result.ranked.reduce((sum, lead) => sum + lead.authorityFollowUpCount, 0);
  assert.equal(total, result.authorityFollowUps.length);
});

test('dignity: residential precision is withheld from stored snippets', async () => {
  assert.equal(
    withholdResidentialPrecision('lived at 411 Maple Street back then'),
    'lived at [address withheld] back then',
  );

  const result = await runInlineCampaign();
  const placeLead = result.campaign.candidates.find((c) =>
    c.adapterRecord.title?.includes('Shiloh'),
  )!;
  const payload = placeLead.adapterRecord.payload as {
    summary?: string;
    livingStatus?: string;
    treatAsLiving?: boolean;
  };
  assert.ok(payload.summary?.includes('[address withheld]'));
  assert.ok(!payload.summary?.includes('411 Maple Street'));

  // Unknown living = living for person mentions.
  const unknownLead = result.campaign.candidates.find((c) =>
    c.adapterRecord.title?.includes('Ozella Greene'),
  )!;
  const unknownPayload = unknownLead.adapterRecord.payload as {
    livingStatus?: string;
    treatAsLiving?: boolean;
  };
  assert.equal(unknownPayload.livingStatus, 'unknown');
  assert.equal(unknownPayload.treatAsLiving, true);
});

test('discovery publish guard holds for the Oral History Pipeline', () => {
  assert.doesNotThrow(() => assertCampaignCannotPublish());
  assert.throws(
    () => assertDiscoveryCannotPublish({ operation: 'write_public_projection' }),
    /Discovery cannot publish/,
  );
  assert.throws(
    () => assertDiscoveryCannotPublish({ operation: 'activate_release', target: 'bb_public' }),
    /Discovery cannot publish/,
  );
  assert.throws(
    () => assertDiscoveryCannotPublish({ operation: 'publish_snapshot' }),
    /Discovery cannot publish/,
  );
  // Non-publish operations pass.
  assert.doesNotThrow(() => assertDiscoveryCannotPublish({ operation: 'score_obscurity' }));
});

test('shipped seed contains at least three real oral-history collections', () => {
  const seed = loadOralHistoryCollectionSeed();
  const collections = seed.flatMap((source) => source.collections);
  assert.ok(collections.length >= 3, 'expected >=3 seeded collections');
  for (const source of seed) {
    assert.equal(source.sourceClass, ORAL_HISTORY_SOURCE_CLASS);
    assert.equal(source.classification, 'community_oral');
    assert.doesNotThrow(() => new URL(source.homepageUrl));
    for (const collection of source.collections) {
      assert.doesNotThrow(() => new URL(collection.collectionUrl));
      assert.equal(collection.sourceId, source.sourceId);
    }
  }
  const urls = collections.map((c) => c.collectionUrl);
  assert.ok(urls.some((u) => u.includes('loc.gov/collections/civil-rights-history-project')));
  assert.ok(urls.some((u) => u.includes('storycorps.org')));
  assert.ok(urls.some((u) => u.includes('finding-aids.lib.unc.edu/04007')));
});
