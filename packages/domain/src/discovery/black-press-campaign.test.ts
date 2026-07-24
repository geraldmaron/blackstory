/**
 * Black Press discovery campaign tests (fixture-first, inline OCR, no network).
 *
 * Covers: campaign yields private candidates; news-index leads classify WEAK
 * (leadOnly → relevance_review); obscurity attached to every ranked lead;
 * authority follow-ups harvested from cited primary sources; and the
 * cannot-publish invariant (ADR-009) holds — including disabled-by-default
 * durable registration.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInMemorySourceRegistry } from '../adapters/index.js';
import {
  BLACK_PRESS_ADAPTER_ID,
  BLACK_PRESS_DEFAULT_CLASSIFICATION,
  BLACK_PRESS_LEAD_ROUTE,
  BLACK_PRESS_SOURCE_CLASS,
  BLACK_PRESS_SOURCE_FITNESS,
  registerBlackPressSource,
  type BlackPressIssueOcr,
  type BlackPressOutlet,
} from '../adapters/black-press/index.js';
import {
  BLACK_PRESS_CAMPAIGN_KIND,
  buildBlackPressQueryPack,
  runBlackPressCampaign,
} from './black-press-campaign.js';
import { assertDiscoveryCannotPublish, FORBIDDEN_DISCOVERY_OPERATIONS } from './guard.js';

const FIXED_NOW = '2026-07-24T00:00:00.000Z';

const DEFENDER: BlackPressOutlet = {
  id: 'outlet_chicago_defender',
  title: 'The Chicago Defender',
  place: 'Chicago, IL',
  foundedYear: 1905,
  archives: [
    {
      kind: 'proquest-black-newspapers',
      url: 'https://about.proquest.com/en/products-services/histnews-bn/',
      access: 'subscription',
    },
  ],
};

const COURIER: BlackPressOutlet = {
  id: 'outlet_pittsburgh_courier',
  title: 'The Pittsburgh Courier',
  place: 'Pittsburgh, PA',
  foundedYear: 1907,
  archives: [
    {
      kind: 'proquest-black-newspapers',
      url: 'https://about.proquest.com/en/products-services/histnews-bn/',
      access: 'subscription',
    },
  ],
};

/** Inline OCR fixture: two redlining-era items, one citing a primary source at loc.gov. */
function defenderIssueOcr(): BlackPressIssueOcr {
  return {
    outletId: DEFENDER.id,
    issueDate: '1938-05-14',
    pages: [
      {
        page: 3,
        text: [
          'Bronzeville homeowners protest HOLC appraisal maps',
          'Residents of the 3400 block petitioned the city after HOLC surveyors marked',
          'the district a colored grade on the security map. A copy of the survey was',
          'deposited with the federal records office, https://www.loc.gov/ collection.',
          '',
          'FHA loan denials mount on the South Side',
          'Applicants report FHA refusals tied to a restrictive covenant recorded in 1927',
          'covering parcels near Washington Park in Chicago, IL.',
        ].join('\n'),
      },
    ],
  };
}

function courierIssueOcr(): BlackPressIssueOcr {
  return {
    outletId: COURIER.id,
    issueDate: '1940-03-09',
    pages: [
      {
        page: 5,
        text: [
          'Hill District appraisal fight continues',
          'A delegation challenged the HOLC redlining of lower Hill blocks and cited',
          'deed records held at https://www.archives.gov/ for the 1931 plat.',
        ].join('\n'),
      },
    ],
  };
}

async function runFixtureCampaign() {
  return await runBlackPressCampaign({
    outlets: [DEFENDER, COURIER],
    issueOcrByOutletId: new Map([
      [DEFENDER.id, [defenderIssueOcr()]],
      [COURIER.id, [courierIssueOcr()]],
    ]),
    theme: 'redlining',
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });
}

test('campaign yields private black-press candidates from seeded outlet OCR', async () => {
  const result = await runFixtureCampaign();

  assert.equal(result.kind, BLACK_PRESS_CAMPAIGN_KIND);
  assert.deepEqual([...result.outletIds].sort(), [DEFENDER.id, COURIER.id].sort());
  assert.ok(result.yield.survivors >= 3, `expected >=3 survivors, got ${result.yield.survivors}`);
  assert.ok(result.ranked.length >= 3);

  for (const candidate of result.campaign.candidates) {
    assert.equal(candidate.adapterRecord.classification, BLACK_PRESS_DEFAULT_CLASSIFICATION);
    assert.equal(candidate.adapterRecord.provenance.adapterId, BLACK_PRESS_ADAPTER_ID);
    const payload = candidate.adapterRecord.payload as {
      sourceClass?: string;
      sourceFitness?: string;
      leadRoute?: string;
      summary?: string;
    };
    assert.equal(payload.sourceClass, BLACK_PRESS_SOURCE_CLASS);
    assert.equal(payload.sourceFitness, BLACK_PRESS_SOURCE_FITNESS);
    assert.equal(payload.leadRoute, BLACK_PRESS_LEAD_ROUTE);
    // Snippet doctrine: capped summaries only, never full OCR bodies.
    assert.ok((payload.summary ?? '').length <= 320);
  }
});

test('news-index leads classify weak (candidate_only) and route to relevance_review', async () => {
  const result = await runFixtureCampaign();

  const survivors = result.campaign.candidates.filter(
    (candidate) => candidate.status === 'accepted' || candidate.status === 'merged',
  );
  assert.ok(survivors.length >= 3);
  for (const candidate of survivors) {
    assert.equal(candidate.signals.strength, 'weak', `lead ${candidate.id} must be weak`);
    assert.equal(candidate.signals.outcome, 'candidate_only');
    assert.ok(candidate.signals.matchedTerms.length > 0, 'lead must still match theme terms');
  }
  for (const lead of result.ranked) {
    assert.equal(lead.signalStrength, 'weak');
    assert.equal(lead.fitness, 'leadOnly');
    assert.equal(lead.route, 'relevance_review');
  }
});

test('theme pack has no positive terms so matches can never classify promotable', () => {
  const pack = buildBlackPressQueryPack('redlining', FIXED_NOW);
  assert.ok(pack.terms.length >= 4);
  assert.ok(pack.terms.every((term) => term.termClass !== 'positive'));
  assert.ok(pack.terms.some((term) => term.text === 'redlining'));
  assert.ok(pack.terms.some((term) => term.text === 'FHA'));
  assert.ok(pack.terms.some((term) => term.text === 'HOLC'));
  const coloredGrade = pack.terms.find((term) => term.text === 'colored grade');
  assert.ok(coloredGrade, 'HOLC period term retained for research recall');
  assert.equal(coloredGrade!.researchOnlyOffensive, true);
});

test('obscurity assessment is attached to every ranked lead', async () => {
  const result = await runFixtureCampaign();

  assert.equal(result.obscurity.length, result.ranked.length);
  for (const assessment of result.obscurity) {
    assert.equal(assessment.methodologyVersion, 'obscurity.v1');
    assert.ok(assessment.score >= 0 && assessment.score <= 1);
    assert.ok(['common', 'notable', 'obscure', 'highly_obscure'].includes(assessment.band));
    assert.equal(assessment.disclaimerId, 'methodology_obscurity_heuristic_v1');
  }
  // Ranked list is obscurity-ordered, most obscure first.
  for (let index = 1; index < result.ranked.length; index += 1) {
    assert.ok(result.ranked[index - 1]!.obscurityScore >= result.ranked[index]!.obscurityScore);
  }
});

test('authority follow-ups are harvested from cited primary sources', async () => {
  const result = await runFixtureCampaign();

  assert.ok(result.authorityFollowUps.length >= 1, 'expected at least one authority follow-up');
  const hosts = new Set(result.authorityFollowUps.map((lead) => lead.host));
  assert.ok(hosts.has('loc.gov') || hosts.has('archives.gov'), `hosts: ${[...hosts].join(', ')}`);
  for (const lead of result.authorityFollowUps) {
    assert.equal(lead.reason, 'authority_host_allowlist');
    assert.equal(lead.sourceClassification, BLACK_PRESS_DEFAULT_CLASSIFICATION);
    assert.ok(lead.url.startsWith('https://'));
  }
});

test('cannot-publish holds: guard armed, forbidden ops throw, registration ships disabled', async () => {
  // Guard is armed and rejects every forbidden publication operation.
  assert.ok(FORBIDDEN_DISCOVERY_OPERATIONS.length > 0);
  for (const operation of FORBIDDEN_DISCOVERY_OPERATIONS) {
    assert.throws(
      () => assertDiscoveryCannotPublish({ operation, target: 'bb_public' }),
      /Discovery cannot publish/,
    );
  }

  // Durable registration is disabled by default: research workers cannot enable publish paths.
  const store = createInMemorySourceRegistry();
  const entry = registerBlackPressSource(store, { createdAt: FIXED_NOW });
  assert.equal(entry.registryState, 'disabled');
  assert.equal(entry.evidenceSource.adapterEnabled, false);

  // Campaign output stays in private discovery statuses only — no public surface.
  const result = await runFixtureCampaign();
  const allowedStatuses = new Set(['pending', 'accepted', 'quarantined', 'dead_letter', 'merged']);
  for (const candidate of result.campaign.candidates) {
    assert.ok(allowedStatuses.has(candidate.status));
  }
});
