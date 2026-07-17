/**
 * Fixture-only eCFR client for BB-087. Parses bundled JSON — no live network in tests.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotsToMonitoringRows } from '../../../legal/monitoring.js';
import type { LegalSnapshot } from '../../../legal/types.js';
import type { LegalAdapterParseResult, LegalFixtureClient } from '../types.js';
import { ECFR_ADAPTER_ID } from './definition.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

type EcfrPartFixture = {
  readonly title: number;
  readonly part: string;
  readonly name: string;
  readonly content: string;
  readonly versionDate: string;
  readonly url: string;
};

function loadFixture(): EcfrPartFixture {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'part-1983.json'), 'utf8')) as EcfrPartFixture;
}

function toSnapshot(part: EcfrPartFixture): LegalSnapshot {
  const externalId = `title-${part.title}/part-${part.part}`;
  return {
    id: `legal-ecfr-${part.title}-${part.part}`,
    slug: `usc-title-${part.title}-section-${part.part}`,
    kind: 'federal-regulation',
    title: part.name,
    jurisdictionId: 'us',
    lawStatus: 'in_force',
    topics: ['employment', 'policing'],
    citation: {
      canonicalCitation: `${part.title} U.S.C. § ${part.part}`,
      licenseTag: 'public-domain',
      archive: {
        sourceUrl: part.url,
        officialUrl: part.url,
        archivedCaptureUrl: `https://web.archive.org/web/20260717000000/${part.url}`,
        retrievedAt: '2026-07-17T00:00:00.000Z',
        changeHash: part.versionDate,
      },
    },
    externalIds: [{ source: ECFR_ADAPTER_ID, externalId }],
  };
}

export function parseEcfrFixtures(): LegalAdapterParseResult {
  const part = loadFixture();
  const snapshots = [toSnapshot(part)];
  return {
    snapshots,
    monitoringRows: snapshotsToMonitoringRows(snapshots, ECFR_ADAPTER_ID),
  };
}

export function createEcfrFixtureClient(): LegalFixtureClient {
  return {
    adapterId: ECFR_ADAPTER_ID,
    parseFixtures: parseEcfrFixtures,
  };
}
