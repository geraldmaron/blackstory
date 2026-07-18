
/**
 * Verifies the discovery-run wrapper calls the real campaign gate and summarizes yield,
 * using this monorepo's existing domain fixtures rather than inventing new candidate shapes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parseCandidateFixtureBatch, parseQueryPackFixture } from '@blap/domain';
import { runBoundedDiscoveryCampaign } from './discovery-run.ts';

const DOMAIN_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'domain', 'src');
const FIXED_NOW = '2026-07-17T04:00:00.000Z';

function loadRecords() {
  const raw = JSON.parse(
    readFileSync(join(DOMAIN_SRC, 'adapters', 'fixtures', 'valid-nara-batch.json'), 'utf8'),
  );
  return parseCandidateFixtureBatch(raw);
}

function loadPack() {
  const raw = JSON.parse(
    readFileSync(
      join(DOMAIN_SRC, 'query-packs', 'fixtures', 'person-civil-rights-fixture.v1.json'),
      'utf8',
    ),
  );
  return parseQueryPackFixture(raw).pack;
}

test('runs a bounded campaign over an already-assembled batch and summarizes yield', () => {
  const records = loadRecords();
  const pack = loadPack();
  const { result, summary } = runBoundedDiscoveryCampaign({
    batch: {
      pack,
      records,
      runContext: {
        runId: 'run-operator-session-1',
        adapterId: records[0]!.provenance.adapterId,
        startedAt: FIXED_NOW,
      },
    },
    config: {
      campaignId: 'operator-campaign-1',
      budget: { maxCandidates: 50, maxQuarantined: 5, maxDeadLetter: 2, maxRetriesPerCandidate: 1 },
      boundaries: { countries: ['US'] },
      continueOnQuarantine: true,
    },
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.equal(summary.campaignId, 'operator-campaign-1');
  assert.equal(summary.totalCandidates, result.candidates.length);
  assert.equal(
    summary.acceptedCount + summary.quarantinedCount + summary.deadLetterCount,
    summary.totalCandidates,
  );
});

test('an invalid budget is rejected by the real domain validation, not silently accepted', () => {
  const records = loadRecords();
  const pack = loadPack();
  assert.throws(
    () =>
      runBoundedDiscoveryCampaign({
        batch: {
          pack,
          records,
          runContext: {
            runId: 'run-operator-session-2',
            adapterId: records[0]!.provenance.adapterId,
            startedAt: FIXED_NOW,
          },
        },
        config: {
          campaignId: 'operator-campaign-2',
          budget: { maxCandidates: 0, maxQuarantined: 5, maxDeadLetter: 2, maxRetriesPerCandidate: 1 },
          boundaries: { countries: ['US'] },
          continueOnQuarantine: true,
        },
        stampedAt: FIXED_NOW,
        completedAt: FIXED_NOW,
      }),
    /maxCandidates/,
  );
});
