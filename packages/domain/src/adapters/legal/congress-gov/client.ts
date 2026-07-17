/**
 * Fixture-only Congress.gov client for BB-087. Parses bundled JSON — no live network in tests.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotsToMonitoringRows } from '../../../legal/monitoring.js';
import type { LegalSnapshot } from '../../../legal/types.js';
import type { LegalAdapterParseResult, LegalFixtureClient } from '../types.js';
import { CONGRESS_GOV_ADAPTER_ID } from './definition.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

type CongressLawFixture = {
  readonly congress: number;
  readonly type: string;
  readonly number: string;
  readonly title: string;
  readonly latestAction: { readonly actionDate: string; readonly text: string };
  readonly url: string;
};

type CongressLawsResponse = {
  readonly laws: readonly CongressLawFixture[];
};

function loadFixture(): CongressLawsResponse {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'laws-response.json'), 'utf8')) as CongressLawsResponse;
}

function toSnapshot(law: CongressLawFixture): LegalSnapshot {
  const externalId = `${law.congress}/${law.type}/${law.number}`;
  return {
    id: `legal-congress-${law.congress}-${law.type}-${law.number}`,
    slug: law.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    kind: 'federal-statute',
    title: law.title,
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: law.title.includes('Voting') ? ['voting'] : ['employment', 'constitutional'],
    citation: {
      canonicalCitation: `Pub. L. ${law.congress}-${law.number}`,
      licenseTag: 'public-domain',
      archive: {
        sourceUrl: law.url,
        officialUrl: law.url,
        archivedCaptureUrl: `https://web.archive.org/web/20260717000000/${law.url}`,
        retrievedAt: '2026-07-17T00:00:00.000Z',
        changeHash: `${law.latestAction.actionDate}:${law.latestAction.text}`,
      },
    },
    externalIds: [{ source: CONGRESS_GOV_ADAPTER_ID, externalId }],
  };
}

export function parseCongressGovFixtures(): LegalAdapterParseResult {
  const response = loadFixture();
  const snapshots = response.laws.map(toSnapshot);
  return {
    snapshots,
    monitoringRows: snapshotsToMonitoringRows(snapshots, CONGRESS_GOV_ADAPTER_ID),
  };
}

export function createCongressGovFixtureClient(): LegalFixtureClient {
  return {
    adapterId: CONGRESS_GOV_ADAPTER_ID,
    parseFixtures: parseCongressGovFixtures,
  };
}
