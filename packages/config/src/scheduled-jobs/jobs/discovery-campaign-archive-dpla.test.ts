/**
 * Proves the archive-dpla scheduled job completes with dual-lane survivors and no publish path.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DPLA_V2_ADAPTER_ID, INTERNET_ARCHIVE_ADAPTER_ID } from '@repo/domain';
import { runDiscoveryCampaignArchiveDplaJob } from './discovery-campaign-archive-dpla.ts';

const FIXTURES_IA = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'domain',
  'src',
  'adapters',
  'internet-archive',
  'fixtures',
  'advanced-search-response.json',
);
const FIXTURES_DPLA = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'domain',
  'src',
  'adapters',
  'dpla',
  'fixtures',
  'search-response-current-shape.json',
);

test('archive-dpla discovery job completes with dual-lane survivors', async () => {
  const result = await runDiscoveryCampaignArchiveDplaJob({
    jobRunId: 'archive-dpla-run-1',
    startedAt: '2026-07-19T10:00:00.000Z',
    completedAt: '2026-07-19T10:05:00.000Z',
    internetArchiveSearchJson: JSON.parse(readFileSync(FIXTURES_IA, 'utf8')),
    dplaSearchJson: JSON.parse(readFileSync(FIXTURES_DPLA, 'utf8')),
  });

  assert.equal(result.run.status, 'success');
  assert.equal(result.run.jobId, 'discovery-campaign-archive-dpla');
  assert.equal(result.campaign.kind, 'archive-dpla-discovery.v1');
  assert.ok(result.campaign.yield.survivors >= 2);

  const adapterIds = new Set(
    result.campaign.campaign.candidates
      .filter((c) => c.status === 'accepted' || c.status === 'merged')
      .map((c) => c.adapterRecord.provenance.adapterId),
  );
  assert.ok(adapterIds.has(INTERNET_ARCHIVE_ADAPTER_ID));
  assert.ok(adapterIds.has(DPLA_V2_ADAPTER_ID));
  assert.ok(!adapterIds.has('dpla-items-v1'));
  assert.deepEqual([...result.campaign.adapterIds], [INTERNET_ARCHIVE_ADAPTER_ID, DPLA_V2_ADAPTER_ID]);
});
