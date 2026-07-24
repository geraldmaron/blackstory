/**
 * Fixture-first tests for the HBCU Special Collections discovery campaign.
 *
 * Proves dual-lane yield (DPLA hub contributor filter + standalone EAD finding aids),
 * obscurity attachment, disabled-by-default registration, snippet caps, and the
 * cannot-publish guard — without live network or publish paths.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DPLA_V2_ADAPTER_ID } from '../adapters/dpla/index.js';
import {
  HBCU_COLLECTIONS_ADAPTER_ID,
  HBCU_COLLECTIONS_SOURCE_CLASS,
  parseHbcuCollectionSeeds,
  registerHbcuCollectionSource,
  type HbcuAdapter,
  type HbcuCollectionSource,
  type HbcuFindingAid,
} from '../adapters/hbcu-collections/index.js';
import { createInMemorySourceRegistry } from '../adapters/index.js';
import {
  FORBIDDEN_DISCOVERY_OPERATIONS,
  assertDiscoveryCannotPublish,
} from './guard.js';
import { listCampaignSurvivors } from './campaign-runner.js';
import {
  HBCU_CAMPAIGN_ADAPTER_IDS,
  HBCU_CAMPAIGN_KIND,
  HBCU_SUB_BUDGET_POLICY,
  filterDplaDocsToHbcuHubs,
  runHbcuCampaign,
} from './hbcu-campaign.js';

const FIXED_NOW = '2026-07-24T12:00:00.000Z';
const SEED_FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'adapters',
  'hbcu-collections',
  'fixtures',
  'hbcu-collections.v1.json',
);

/** Inline seeds — one DPLA hub lane (Fisk) + one standalone EAD lane (Howard MSRC). */
const INLINE_SOURCES: readonly HbcuCollectionSource[] = [
  {
    id: 'howard-msrc',
    registryEntryId: 'reg_hbcu_howard_msrc',
    sourceId: 'src_hbcu_howard_msrc',
    organizationId: 'org_howard_university',
    institution: 'howard',
    displayName: 'Howard University Moorland-Spingarn Research Center',
    state: 'US-DC',
    collectionUrl: 'https://msrc.howard.edu/',
    findingAidBaseUrl: 'https://dh.howard.edu/',
    lane: 'ead-finding-aid',
    sourceClass: HBCU_COLLECTIONS_SOURCE_CLASS,
  },
  {
    id: 'fisk-franklin-library',
    registryEntryId: 'reg_hbcu_fisk_franklin',
    sourceId: 'src_hbcu_fisk_franklin',
    organizationId: 'org_fisk_university',
    institution: 'fisk',
    displayName: 'Fisk University Franklin Library Special Collections',
    state: 'US-TN',
    collectionUrl: 'https://www.fisk.edu/academics/john-hope-and-aurelia-e-franklin-library/',
    lane: 'dpla-hub',
    dplaContributorMatch: 'Fisk University',
    sourceClass: HBCU_COLLECTIONS_SOURCE_CLASS,
  },
];

/** Inline DPLA v2 search JSON: one Fisk-contributed doc, one non-HBCU doc to be skipped. */
const INLINE_DPLA_SEARCH_JSON = {
  count: 2,
  docs: [
    {
      id: 'fisk-rosenwald-0001',
      dataProvider: 'Fisk University, John Hope and Aurelia E. Franklin Library',
      isShownAt: 'https://dp.la/item/fisk-rosenwald-0001',
      sourceResource: {
        title: 'Rosenwald Fund school building program correspondence',
        description:
          'Correspondence documenting rural school construction for Black communities, Nashville, TN.',
        date: { displayDate: '1928-1932' },
        subject: [{ name: 'Education' }, { name: 'Rosenwald schools' }],
      },
    },
    {
      id: 'other-county-0002',
      dataProvider: 'Example County Historical Museum',
      isShownAt: 'https://dp.la/item/other-county-0002',
      sourceResource: {
        title: 'County fairground postcard',
        description: 'Postcard of a county fairground, undated.',
      },
    },
  ],
};

const HOWARD_FINDING_AID: HbcuFindingAid = {
  institution: 'howard',
  findingAidId: 'msrc-ead-0154',
  title: 'Civil rights organizational records finding aid',
  repository: 'Moorland-Spingarn Research Center',
  state: 'US-DC',
  findingAidUrl: 'https://dh.howard.edu/finding-aids-sample',
  coveragePeriod: '1935-1968',
};

function stubHbcuAdapter(): HbcuAdapter {
  return {
    adapterId: HBCU_COLLECTIONS_ADAPTER_ID,
    listFindingAids(institution: string) {
      return institution === 'howard' ? [HOWARD_FINDING_AID] : [];
    },
    extractCandidates(findingAid: HbcuFindingAid) {
      return [
        {
          title: 'Neighborhood civic league records, Washington, DC',
          canonicalUrl: `${findingAid.findingAidUrl}#series-1`,
          repository: findingAid.repository,
          institution: findingAid.institution,
          findingAidId: findingAid.findingAidId,
          state: findingAid.state,
          summary:
            'Series of meeting minutes and correspondence from a neighborhood civic league. ' +
            'Long summary text repeated to exercise the snippet cap. '.repeat(20),
          eadComponentId: 'series-1',
        },
        {
          title: 'Oral history transcripts inventory',
          canonicalUrl: `${findingAid.findingAidUrl}#series-2`,
          repository: findingAid.repository,
          institution: findingAid.institution,
          findingAidId: findingAid.findingAidId,
          state: findingAid.state,
          summary: 'Inventory of oral history transcripts; access copies listed by decade.',
          eadComponentId: 'series-2',
        },
      ];
    },
  };
}

async function runCampaign() {
  return runHbcuCampaign({
    sources: INLINE_SOURCES,
    dplaSearchJson: INLINE_DPLA_SEARCH_JSON,
    hbcuAdapter: stubHbcuAdapter(),
    catalogTitles: ['Fisk University', 'Howard University'],
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });
}

test('registerHbcuCollectionSource registers scholarly-class source disabled by default', () => {
  const store = createInMemorySourceRegistry();
  const entry = registerHbcuCollectionSource({
    store,
    source: INLINE_SOURCES[0]!,
    createdAt: FIXED_NOW,
  });
  assert.equal(entry.registryState, 'disabled');
  assert.equal(entry.contract.adapterId, HBCU_COLLECTIONS_ADAPTER_ID);
  assert.equal(entry.evidenceSource.classification, 'primary_archival');
  assert.equal(HBCU_COLLECTIONS_SOURCE_CLASS, 'scholarly');
  assert.match(entry.contract.policy.notes ?? '', /sourceClass=scholarly/);
});

test('campaign yields candidates from both lanes with HBCU contributor filter', async () => {
  const result = await runCampaign();

  assert.equal(result.kind, HBCU_CAMPAIGN_KIND);
  assert.deepEqual(result.adapterIds, HBCU_CAMPAIGN_ADAPTER_IDS);
  assert.deepEqual(result.seededSourceIds, ['howard-msrc']);

  // DPLA lane: only the Fisk-contributed doc survives the contributor filter.
  assert.equal(result.subBudget.dplaHubIngested, 1);
  assert.equal(result.subBudget.dplaNonHbcuSkipped, 1);
  assert.equal(result.subBudget.findingAidIngested, 2);
  assert.equal(result.subBudget.combinedIngested, 3);
  assert.equal(result.subBudget.policy, HBCU_SUB_BUDGET_POLICY);

  const survivors = listCampaignSurvivors(result.campaign);
  assert.ok(survivors.length >= 2);
  const adapterIds = new Set(survivors.map((c) => c.adapterRecord.provenance.adapterId));
  assert.ok(adapterIds.has(HBCU_COLLECTIONS_ADAPTER_ID));
  assert.ok(adapterIds.has(DPLA_V2_ADAPTER_ID));
  assert.ok(!adapterIds.has('dpla-items-v1'));
  assert.equal(result.yield.survivors, survivors.length);
});

test('filterDplaDocsToHbcuHubs drops non-HBCU contributors', () => {
  const { matched, skippedCount } = filterDplaDocsToHbcuHubs(
    [
      { id: 'a', title: 'A', providerName: 'Fisk University Library' },
      { id: 'b', title: 'B', providerName: 'Unrelated Museum' },
      { id: 'c', title: 'C' },
    ],
    INLINE_SOURCES,
  );
  assert.equal(matched.length, 1);
  assert.equal(matched[0]?.id, 'a');
  assert.equal(skippedCount, 2);
});

test('obscurity assessments are attached to every ranked survivor', async () => {
  const result = await runCampaign();
  const survivors = listCampaignSurvivors(result.campaign);
  assert.equal(result.ranked.length, survivors.length);
  for (const lead of result.ranked) {
    assert.equal(lead.obscurity.methodologyVersion, 'obscurity.v1');
    assert.ok(lead.obscurity.score >= 0 && lead.obscurity.score <= 1);
    assert.ok(['common', 'notable', 'obscure', 'highly_obscure'].includes(lead.obscurity.band));
    assert.equal(lead.obscurity.disclaimerId, result.disclaimer.id);
    assert.equal(lead.obscurity.assessedAt, FIXED_NOW);
  }
  // Ranked is sorted descending by score.
  for (let i = 1; i < result.ranked.length; i += 1) {
    assert.ok(result.ranked[i - 1]!.obscurity.score >= result.ranked[i]!.obscurity.score);
  }
});

test('snippet doctrine holds: EAD summaries are capped before yield', async () => {
  const result = await runCampaign();
  for (const survivor of listCampaignSurvivors(result.campaign)) {
    const summary =
      (survivor.adapterRecord.payload as { summary?: string }).summary ??
      survivor.adapterRecord.title ??
      '';
    assert.ok(summary.length <= 320);
    assert.ok(summary.split(/\s+/u).filter(Boolean).length <= 60);
  }
});

test('cannot-publish guard holds for the HBCU campaign', async () => {
  const result = await runCampaign();
  // Guard is armed and rejects every forbidden publish operation.
  assert.ok(FORBIDDEN_DISCOVERY_OPERATIONS.length > 0);
  for (const operation of FORBIDDEN_DISCOVERY_OPERATIONS) {
    assert.throws(() => assertDiscoveryCannotPublish({ operation }), /Discovery cannot publish/);
  }
  // Campaign output is private-candidate-only: statuses never include a public/published state.
  const privateStatuses = new Set(['pending', 'accepted', 'merged', 'quarantined', 'dead_letter']);
  for (const candidate of result.campaign.candidates) {
    assert.ok(privateStatuses.has(candidate.status), `unexpected status ${candidate.status}`);
  }
});

test('shipped seed fixture parses: >=4 real HBCU collections over https', () => {
  const raw = JSON.parse(readFileSync(SEED_FIXTURE_PATH, 'utf8')) as unknown;
  const sources = parseHbcuCollectionSeeds(raw);
  assert.ok(sources.length >= 4);
  const institutions = new Set(sources.map((s) => s.institution));
  for (const expected of ['howard', 'fisk', 'tuskegee', 'hampton']) {
    assert.ok(institutions.has(expected), `missing seeded institution ${expected}`);
  }
  for (const source of sources) {
    assert.equal(source.sourceClass, 'scholarly');
    assert.ok(source.collectionUrl.startsWith('https://'));
    assert.doesNotThrow(() => new URL(source.collectionUrl));
  }
});
