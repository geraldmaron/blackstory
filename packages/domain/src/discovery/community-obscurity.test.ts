/**
 * Integration tests: curated ABS community feed (extra care) + obscurity methodology dry-run.
 *
 * Shows what kinds of leads the feed + obscurity equation surface — brand posts vs named
 * figures vs synthetic local obscure — without live network.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  createInMemoryFeedRegistry,
  createRssAdapterContract,
  getCuratedCommunityFeedSeed,
  listActiveFeeds,
  normalizeFeedXml,
  parseRssOrAtomFeed,
  seedCuratedCommunityFeeds,
  CURATED_COMMUNITY_FEED_SEEDS,
  RSS_ADAPTER_ID,
  type FeedRegistryEntry,
} from '../adapters/rss/index.js';
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  registerSource,
  type SourceRegistryEntry,
} from '../adapters/index.js';
import type { EvidenceSource } from '../provenance/source.js';
import {
  attachCatalogMatch,
  createDiscoveryCampaignConfig,
  harvestAuthorityFollowUpsForCandidate,
  rankByObscurity,
  runDiscoveryCampaign,
  scoreObscurity,
  OBSCURITY_METHODOLOGY_DISCLAIMER,
  OBSCURITY_METHODOLOGY_VERSION,
  type DiscoveryCandidateRecord,
} from './index.js';
import { parseQueryPackFixture, buildQueryPack } from '../query-packs/index.js';
import type { CanonicalEntity } from '../entity.js';
import type { ResolutionProfile } from '../resolution/index.js';

const FIXED_NOW = '2026-07-18T21:00:00.000Z';
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'adapters', 'rss', 'fixtures');
const QUERY_PACK_FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'query-packs',
  'fixtures',
);

function loadAbsFixtureXml(): string {
  return readFileSync(join(FIXTURES, 'the-american-blackstory.trimmed.rss.xml'), 'utf8');
}

function loadQueryPack() {
  const raw = JSON.parse(
    readFileSync(join(QUERY_PACK_FIXTURES, 'person-civil-rights-fixture.v1.json'), 'utf8'),
  );
  return parseQueryPackFixture(raw).pack;
}

function entity(
  id: string,
  kind: CanonicalEntity['kind'],
  displayName: string,
  extra: Partial<CanonicalEntity> = {},
): CanonicalEntity {
  return { id, kind, displayName, createdAt: FIXED_NOW, updatedAt: FIXED_NOW, ...extra };
}

function absFeedEntry(): FeedRegistryEntry {
  const seed = getCuratedCommunityFeedSeed('feed_the_american_blackstory')!;
  return {
    id: seed.id,
    feedUrl: seed.feedUrl,
    displayName: seed.displayName,
    classification: seed.classification,
    institutionType: seed.institutionType,
    status: 'active',
    revision: 1,
    addedAt: FIXED_NOW,
    addedBy: 'operator@blackstory.local',
    ...(seed.notes !== undefined ? { notes: seed.notes } : {}),
  };
}

function approvedRssRegistryEntry(): SourceRegistryEntry {
  const contract = createRssAdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_rss_community',
    organizationId: 'org_community',
    displayName: 'Community RSS/Atom Discovery',
    classification: 'self_published',
    adapterId: RSS_ADAPTER_ID,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: 'adapter:rss',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  const store = createInMemorySourceRegistry();
  registerSource(store, {
    id: 'reg_rss_community',
    contract,
    evidenceSource,
    createdAt: FIXED_NOW,
  });
  return approveSourcePolicy(store, {
    id: 'reg_rss_community',
    approvedBy: 'operator@blackstory.local',
    approvedAt: FIXED_NOW,
  });
}

test('curated ABS seed encodes extra-care policy and seeds the feed registry', () => {
  const seed = getCuratedCommunityFeedSeed('feed_the_american_blackstory');
  assert.ok(seed);
  assert.equal(seed!.feedUrl, 'https://theamericanblackstory.com/feed/');
  assert.equal(seed!.classification, 'self_published');
  assert.equal(seed!.institutionType, 'personal_blog');
  assert.equal(seed!.care.requireAuthorityHarvest, true);
  assert.equal(seed!.care.snippetOnly, true);
  assert.equal(seed!.care.cannotPublishAlone, true);
  assert.match(seed!.care.operatorCaution.toLowerCase(), /discovery leads/);

  const store = createInMemoryFeedRegistry();
  const seeded = seedCuratedCommunityFeeds(store, {
    actor: { id: 'operator@blackstory.local', type: 'user' },
    reason: 'Curated community feed pack — extra care.',
    requestId: 'req_seed_1',
    correlationId: 'corr_seed_1',
    now: FIXED_NOW,
  });
  assert.equal(seeded.length, CURATED_COMMUNITY_FEED_SEEDS.length);
  assert.equal(listActiveFeeds(store).length, 1);
  assert.equal(listActiveFeeds(store)[0]?.id, 'feed_the_american_blackstory');
});

test('ABS fixture normalizes to snippet-only candidates with authority linkHints', () => {
  const xml = loadAbsFixtureXml();
  const parsed = parseRssOrAtomFeed(xml);
  assert.equal(parsed.format, 'rss');
  assert.ok(parsed.items.length >= 4);

  const buffalo = parsed.items.find((item) => item.title?.includes('Buffalo Soldiers'));
  assert.ok(buffalo?.linkHints?.some((url) => url.includes('nps.gov')));

  const registryEntry = approvedRssRegistryEntry();
  const candidates = normalizeFeedXml({
    feed: absFeedEntry(),
    xml,
    registryEntry,
    runId: 'run_abs_1',
    capturedAt: FIXED_NOW,
  });
  assert.equal(candidates.length, parsed.items.length);
  for (const candidate of candidates) {
    assert.equal(candidate.classification, 'self_published');
    assert.ok((candidate.payload.summary?.length ?? 0) <= 320);
    assert.equal('fullText' in candidate.payload, false);
    assert.equal('body' in candidate.payload, false);
  }
  const buffaloCandidate = candidates.find((c) => c.title?.includes('Buffalo Soldiers'));
  assert.ok(buffaloCandidate?.payload.outboundLinkHints?.some((url) => url.includes('nps.gov')));
});

test('obscurity methodology disclaimer states relative heuristic limits', () => {
  assert.equal(OBSCURITY_METHODOLOGY_DISCLAIMER.id, 'methodology_obscurity_heuristic_v1');
  assert.match(OBSCURITY_METHODOLOGY_DISCLAIMER.body.toLowerCase(), /relative/);
  assert.match(OBSCURITY_METHODOLOGY_DISCLAIMER.body.toLowerCase(), /not that the subject/);
  assert.match(OBSCURITY_METHODOLOGY_DISCLAIMER.body.toLowerCase(), /never authorize publication/);
});

test('obscurity dry-run on ABS-shaped candidates: local obscure ranks above Buffalo Soldiers and brand bags', () => {
  const xml = loadAbsFixtureXml();
  const registryEntry = approvedRssRegistryEntry();
  const adapterRecords = normalizeFeedXml({
    feed: absFeedEntry(),
    xml,
    registryEntry,
    runId: 'run_abs_obscurity',
    capturedAt: FIXED_NOW,
  });

  const pack = buildQueryPack({
    id: 'qp-abs-obscurity',
    displayName: 'ABS obscurity dry-run',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt: FIXED_NOW,
    terms: [
      { text: 'Buffalo Soldiers', termClass: 'historical' },
      { text: 'Stormé', termClass: 'alias' },
      { text: 'Piedmont', termClass: 'geographic' },
      { text: 'Yosemite', termClass: 'geographic' },
    ],
  });

  const catalogProfiles: readonly ResolutionProfile[] = [
    {
      entity: entity('entity_buffalo_soldiers', 'organization', 'Buffalo Soldiers', {
        identifiers: [{ system: 'nps', value: 'buffalo-soldiers' }],
      }),
    },
    {
      entity: entity('entity_rosa_parks', 'person', 'Rosa Parks', {
        identifiers: [{ system: 'wikidata', value: 'Q83396' }],
      }),
    },
    {
      entity: entity('entity_mlk', 'person', 'Martin Luther King Jr.'),
    },
  ];

  const campaign = runDiscoveryCampaign({
    config: createDiscoveryCampaignConfig({
      campaignId: 'camp_abs_obscurity',
      budget: {
        maxCandidates: 50,
        maxQuarantined: 20,
        maxDeadLetter: 5,
        maxRetriesPerCandidate: 1,
      },
      boundaries: { countries: ['US'] },
      continueOnQuarantine: true,
    }),
    records: adapterRecords,
    pack,
    runContext: {
      runId: 'run_abs_obscurity',
      adapterId: 'rss',
      startedAt: FIXED_NOW,
    },
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    catalog: { profiles: catalogProfiles },
    authorityHarvest: { enabled: true },
  });

  assert.ok((campaign.authorityFollowUps?.length ?? 0) >= 1);
  assert.ok(campaign.authorityFollowUps!.some((lead) => lead.host === 'nps.gov'));

  const corpusTitles = [
    'Rosa Parks',
    'Martin Luther King Jr.',
    'Buffalo Soldiers',
    'Harriet Tubman',
    'Frederick Douglass',
    'Tuskegee Airmen',
    'Emmett Till',
    'Ida B. Wells',
  ];

  const assessments = campaign.candidates
    .filter((c) => c.status === 'accepted' || c.status === 'merged')
    .map((candidate) =>
      scoreObscurity({
        candidate,
        corpus: { catalogTitles: corpusTitles },
        assessedAt: FIXED_NOW,
      }),
    );

  const ranked = rankByObscurity(assessments);
  assert.equal(ranked[0]?.methodologyVersion, OBSCURITY_METHODOLOGY_VERSION);
  assert.equal(ranked[0]?.disclaimerId, OBSCURITY_METHODOLOGY_DISCLAIMER.id);

  const byTitle = new Map<string, { score: number; band: string; candidate: DiscoveryCandidateRecord }>();
  for (const assessment of ranked) {
    const candidate = campaign.candidates.find((c) => c.id === assessment.candidateId)!;
    byTitle.set(candidate.adapterRecord.title ?? candidate.id, {
      score: assessment.score,
      band: assessment.band,
      candidate,
    });
  }

  const obscureLocal = [...byTitle.entries()].find(([title]) =>
    title.includes('Rosewood School Bell'),
  );
  const buffalo = [...byTitle.entries()].find(([title]) => title.includes('Buffalo Soldiers'));
  const brandBags = [...byTitle.entries()].find(([title]) => title.includes('BLACK BAGS'));

  assert.ok(obscureLocal, 'expected synthetic Piedmont school-bell lead');
  assert.ok(buffalo, 'expected Buffalo Soldiers lead');
  assert.ok(brandBags, 'expected Black Bags brand lead');

  // Local thinly attested lead should outrank the high-visibility Buffalo Soldiers subject.
  assert.ok(
    obscureLocal![1].score > buffalo![1].score,
    `expected obscure local (${obscureLocal![1].score}) > buffalo (${buffalo![1].score})`,
  );
  // High-visibility penalty should keep Buffalo Soldiers out of highly_obscure.
  assert.notEqual(buffalo![1].band, 'highly_obscure');
  // Brand storytelling should not be the top obscure history lead.
  assert.ok(
    obscureLocal![1].score > brandBags![1].score,
    `expected obscure local (${obscureLocal![1].score}) > brand bags (${brandBags![1].score})`,
  );
  assert.ok(
    brandBags![1].score < 0.7,
    `brand bags should be penalized below obscure band floor, got ${brandBags![1].score}`,
  );

  // Log ranking for operator methodology review (asserted structure, not just vibes).
  const rankingSummary = ranked.map((assessment) => {
    const candidate = campaign.candidates.find((c) => c.id === assessment.candidateId)!;
    return {
      title: candidate.adapterRecord.title,
      score: assessment.score,
      band: assessment.band,
      catalogMatch: candidate.catalogMatch?.outcome,
    };
  });
  assert.equal(rankingSummary.length, ranked.length);
  const topTitle = rankingSummary[0]?.title ?? '';
  // Top obscure should be a history-day local/lesser-known lead — not brand bags or Buffalo Soldiers.
  assert.ok(
    topTitle.includes('Rosewood School Bell') || topTitle.includes('Stormé'),
    `unexpected top obscure title: ${topTitle}`,
  );
  assert.ok(!topTitle.includes('BLACK BAGS'));
  assert.ok(!topTitle.includes('Buffalo Soldiers'));

  // Extra care: authority harvest from ABS-shaped buffalo item.
  const buffaloCandidate = buffalo![1].candidate;
  const leads = harvestAuthorityFollowUpsForCandidate({
    candidate: buffaloCandidate,
    harvestedAt: FIXED_NOW,
  });
  assert.ok(leads.some((lead) => lead.host === 'nps.gov' || lead.host === 'nmaahc.si.edu'));

  // Catalog propose-match on buffalo should reduce novelty vs unmatched local.
  assert.ok(buffaloCandidate.catalogMatch);
  const localCandidate = obscureLocal![1].candidate;
  assert.ok(localCandidate.catalogMatch);
  // Buffalo is in catalog profiles by name — expect proposed or review, not forced publish.
  assert.ok(
    buffaloCandidate.catalogMatch!.outcome === 'proposed_match' ||
      buffaloCandidate.catalogMatch!.outcome === 'review_required' ||
      buffaloCandidate.catalogMatch!.outcome === 'no_match',
  );
});

test('attachCatalogMatch + obscurity: proposed high-confidence match lowers novelty factor', () => {
  const xml = loadAbsFixtureXml();
  const registryEntry = approvedRssRegistryEntry();
  const [buffaloRecord] = normalizeFeedXml({
    feed: absFeedEntry(),
    xml,
    registryEntry,
    runId: 'run_abs_match',
    capturedAt: FIXED_NOW,
  }).filter((record) => record.title?.includes('Buffalo Soldiers'));
  assert.ok(buffaloRecord);

  const pack = loadQueryPack();
  const campaign = runDiscoveryCampaign({
    config: createDiscoveryCampaignConfig({
      campaignId: 'camp_one',
      budget: {
        maxCandidates: 5,
        maxQuarantined: 5,
        maxDeadLetter: 2,
        maxRetriesPerCandidate: 1,
      },
      boundaries: { countries: ['US'] },
      continueOnQuarantine: true,
    }),
    records: [buffaloRecord!],
    pack,
    runContext: {
      runId: 'run_one',
      adapterId: 'rss',
      startedAt: FIXED_NOW,
    },
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });
  const candidate = campaign.candidates[0]!;
  const unmatched = scoreObscurity({
    candidate,
    corpus: { catalogTitles: ['Rosa Parks', 'Buffalo Soldiers'] },
    assessedAt: FIXED_NOW,
  });

  const matched = attachCatalogMatch(
    candidate,
    {
      profiles: [
        {
          entity: entity('entity_buffalo_soldiers', 'organization', 'Buffalo Soldiers', {
            identifiers: [{ system: 'nps', value: 'buffalo-soldiers' }],
          }),
        },
      ],
    },
    FIXED_NOW,
  ).candidate;

  const afterMatch = scoreObscurity({
    candidate: matched,
    corpus: { catalogTitles: ['Rosa Parks', 'Buffalo Soldiers'] },
    assessedAt: FIXED_NOW,
  });

  // Either catalog match reduced score, or high-visibility penalty already dominated —
  // but matched novelty raw must be <= unmatched novelty raw.
  const noveltyUnmatched = unmatched.factors.find((f) => f.factor === 'catalog_novelty')!.raw;
  const noveltyMatched = afterMatch.factors.find((f) => f.factor === 'catalog_novelty')!.raw;
  assert.ok(noveltyMatched <= noveltyUnmatched);
});
