/**
 * Fixture-only CourtListener client. Parses bundled bulk JSON no live network in tests.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotsToMonitoringRows } from '../../../legal/monitoring.js';
import type { LegalSnapshot } from '../../../legal/types.js';
import type { LegalAdapterParseResult, LegalFixtureClient } from '../types.js';
import { COURTLISTENER_ADAPTER_ID } from './definition.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

type CourtListenerOpinionFixture = {
  readonly id: number;
  readonly caseName: string;
  readonly citation: string;
  readonly dateFiled: string;
  readonly court: string;
  readonly url: string;
};

function loadFixture(): readonly CourtListenerOpinionFixture[] {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'opinions-bulk.json'), 'utf8')) as readonly CourtListenerOpinionFixture[];
}

function inferTopics(caseName: string): readonly ('voting' | 'education' | 'constitutional')[] {
  if (caseName.includes('Shelby')) return ['voting', 'constitutional'];
  if (caseName.includes('Brown')) return ['education', 'constitutional'];
  return ['constitutional'];
}

function inferStatus(caseName: string): 'in_force' | 'struck_down' | 'amended' {
  if (caseName.includes('Shelby')) return 'in_force';
  return 'in_force';
}

function toSnapshot(opinion: CourtListenerOpinionFixture): LegalSnapshot {
  const externalId = String(opinion.id);
  return {
    id: `legal-cl-${opinion.id}`,
    slug: opinion.caseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    kind: 'landmark-case',
    title: opinion.caseName,
    jurisdictionId: 'us',
    lawStatus: inferStatus(opinion.caseName),
    topics: inferTopics(opinion.caseName),
    citation: {
      canonicalCitation: opinion.citation,
      licenseTag: 'public-domain',
      archive: {
        sourceUrl: opinion.url,
        officialUrl: opinion.url,
        archivedCaptureUrl: `https://web.archive.org/web/20260717000000/${opinion.url}`,
        retrievedAt: '2026-07-17T00:00:00.000Z',
        changeHash: `${opinion.dateFiled}:${opinion.citation}`,
      },
    },
    externalIds: [{ source: COURTLISTENER_ADAPTER_ID, externalId }],
  };
}

export function parseCourtListenerFixtures(): LegalAdapterParseResult {
  const opinions = loadFixture();
  const snapshots = opinions.map(toSnapshot);
  return {
    snapshots,
    monitoringRows: snapshotsToMonitoringRows(snapshots, COURTLISTENER_ADAPTER_ID),
  };
}

export function createCourtListenerFixtureClient(): LegalFixtureClient {
  return {
    adapterId: COURTLISTENER_ADAPTER_ID,
    parseFixtures: parseCourtListenerFixtures,
  };
}

/** Validates a case cite against the fixture corpus (Citation Lookup stand-in). */
export function validateCaseCitationInFixtures(citation: string): boolean {
  const opinions = loadFixture();
  return opinions.some((opinion) => opinion.citation === citation);
}
