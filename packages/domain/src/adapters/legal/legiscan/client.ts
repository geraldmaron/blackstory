/**
 * Fixture-only LegiScan client for BB-087. Parses bundled masterlist JSON — no live network in tests.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotsToMonitoringRows } from '../../../legal/monitoring.js';
import type { LegalSnapshot } from '../../../legal/types.js';
import type { LegalAdapterParseResult, LegalFixtureClient } from '../types.js';
import { LEGISCAN_ADAPTER_ID } from './definition.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

type LegiScanBillFixture = {
  readonly bill_id: number;
  readonly change_hash: string;
  readonly number: string;
  readonly title: string;
  readonly status: number;
  readonly status_date: string;
  readonly state_link: string;
};

type LegiScanMasterlistFixture = {
  readonly status: string;
  readonly masterlist: {
    readonly session: {
      readonly session_id: number;
      readonly state_id: number;
      readonly year_start: number;
      readonly year_end: number;
    };
    readonly bills: readonly LegiScanBillFixture[];
  };
};

function loadFixture(): LegiScanMasterlistFixture {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'masterlist-ga-2025.json'), 'utf8')) as LegiScanMasterlistFixture;
}

function toSnapshot(bill: LegiScanBillFixture, stateId: number): LegalSnapshot {
  const externalId = String(bill.bill_id);
  return {
    id: `legal-legiscan-${bill.bill_id}`,
    slug: `${bill.number.toLowerCase()}-ga-${bill.status_date.slice(0, 4)}`,
    kind: 'state-statute',
    title: bill.title,
    jurisdictionId: `us-${String(stateId).padStart(2, '0')}`,
    lawStatus: bill.status >= 4 ? 'in_force' : 'amended',
    topics: ['voting'],
    citation: {
      canonicalCitation: `${bill.number} (${bill.status_date.slice(0, 4)})`,
      licenseTag: 'link-only',
      archive: {
        sourceUrl: `https://api.legiscan.com/?op=getBill&id=${bill.bill_id}`,
        officialUrl: bill.state_link,
        archivedCaptureUrl: `https://web.archive.org/web/20260717000000/${bill.state_link}`,
        retrievedAt: '2026-07-17T00:00:00.000Z',
        changeHash: bill.change_hash,
      },
    },
    externalIds: [{ source: LEGISCAN_ADAPTER_ID, externalId }],
  };
}

export function parseLegiScanFixtures(): LegalAdapterParseResult {
  const response = loadFixture();
  const stateId = response.masterlist.session.state_id;
  const snapshots = response.masterlist.bills.map((bill) => toSnapshot(bill, stateId));
  return {
    snapshots,
    monitoringRows: snapshotsToMonitoringRows(snapshots, LEGISCAN_ADAPTER_ID),
  };
}

export function createLegiScanFixtureClient(): LegalFixtureClient {
  return {
    adapterId: LEGISCAN_ADAPTER_ID,
    parseFixtures: parseLegiScanFixtures,
  };
}

/** Returns bills whose change_hash differs from the supplied prior map. */
export function diffLegiScanChangeHashes(
  prior: ReadonlyMap<number, string>,
): readonly { readonly billId: number; readonly previousHash: string; readonly newHash: string }[] {
  const response = loadFixture();
  const changes: { billId: number; previousHash: string; newHash: string }[] = [];
  for (const bill of response.masterlist.bills) {
    const previous = prior.get(bill.bill_id);
    if (previous !== undefined && previous !== bill.change_hash) {
      changes.push({ billId: bill.bill_id, previousHash: previous, newHash: bill.change_hash });
    }
  }
  return changes;
}
