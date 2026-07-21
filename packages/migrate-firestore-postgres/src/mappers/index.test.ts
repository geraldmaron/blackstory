/**
 * Mapper unit tests for high-value Firestore → bb_* row transforms.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mapActiveRelease,
  mapCensusNationalDecade,
  mapEvidenceSource,
  mapKillSwitch,
  mapPolicyActive,
  mapPublicationRelease,
  mapResearchCase,
  mapSourceCapture,
  mapSourceItem,
} from './index.js';

describe('ops/public mappers', () => {
  it('maps policy active singleton', () => {
    const row = mapPolicyActive('active', {
      policyVersion: 'policy.v1',
      activatedAt: '2026-07-16T18:00:00.000Z',
    });
    assert.deepEqual(row, {
      id: 'active',
      policy_version: 'policy.v1',
      activated_at: '2026-07-16T18:00:00.000Z',
    });
    assert.equal(mapPolicyActive('other', {}), null);
  });

  it('maps kill switch', () => {
    const row = mapKillSwitch('research-campaigns', {
      enabled: false,
      reason: 'pause',
      updatedAt: '2026-07-19T01:14:00.000Z',
    });
    assert.equal(row.id, 'research-campaigns');
    assert.equal(row.enabled, false);
  });

  it('maps publication release + active pointer', () => {
    const release = mapPublicationRelease('rel_seed_001', {
      releaseId: 'rel_seed_001',
      status: 'active',
      searchIndexVersion: 'search_seed_001',
      signedManifest: { algorithm: 'bootstrap-unsigned' },
      createdAt: '2026-07-16T18:00:00.000Z',
      activatedAt: '2026-07-16T18:00:00.000Z',
    });
    assert.equal(release.id, 'rel_seed_001');
    assert.equal(release.status, 'active');
    const active = mapActiveRelease({
      releaseId: 'rel_seed_001',
      activatedAt: '2026-07-16T18:00:00.000Z',
      manifestHash: 'aaa',
    });
    assert.equal(active.release_id, 'rel_seed_001');
  });
});

describe('evidence + research mappers', () => {
  it('maps evidence source rights from policy', () => {
    const row = mapEvidenceSource('src_x', {
      displayName: 'FBI',
      adapterId: 'external-data:x',
      adapterEnabled: false,
      policy: { rights: { defaultStatus: 'public_domain' } },
      createdAt: '2026-07-18T07:15:20.570Z',
      updatedAt: '2026-07-18T07:15:20.570Z',
    });
    assert.equal(row.display_name, 'FBI');
    assert.deepEqual(row.rights, { defaultStatus: 'public_domain' });
  });

  it('maps source item + capture storage ref', () => {
    const item = mapSourceItem('item_1', {
      sourceId: 'src_x',
      stableIdentifier: 'https://example.test/a',
      title: 'T',
      createdAt: '2026-07-18T07:15:20.570Z',
    });
    assert.equal(item.source_id, 'src_x');
    const cap = mapSourceCapture('cap_1', {
      sourceItemId: 'item_1',
      contentHash: { algorithm: 'sha256', digest: 'abc' },
      snapshotStorageObject: 'gs://bucket/obj',
      retrievedAt: '2026-07-18T07:15:20.570Z',
    });
    assert.equal(cap.content_hash_digest, 'abc');
    assert.deepEqual(cap.storage_object, { uri: 'gs://bucket/obj' });
  });

  it('normalizes research case history and checklist', () => {
    const mapped = mapResearchCase('case-1', {
      candidateId: 'cand-1',
      title: 'Title',
      state: 'excluded',
      history: [
        {
          from: 'candidate',
          to: 'excluded',
          reasonCode: 'outside_scope',
          actorId: 'bot',
          occurredAt: '2026-07-19T17:48:29.803Z',
          evidenceIds: [],
        },
      ],
      checklist: { items: [{ key: 'min_record', complete: false }] },
      createdAt: '2026-07-19T06:44:08.496Z',
      updatedAt: '2026-07-19T17:48:29.803Z',
    });
    assert.equal(mapped.caseRow.state, 'excluded');
    assert.equal(mapped.history.length, 1);
    assert.equal(mapped.history[0]?.to_state, 'excluded');
    assert.equal(mapped.checklist[0]?.key, 'min_record');
  });
});

describe('reference mappers', () => {
  it('maps census national decade with provenance quartet', () => {
    const row = mapCensusNationalDecade('1790', {
      decade: '1790',
      totalPopulation: 3929214,
      source: 'us-census-historical-race-1790-1990',
      sourceUrl: 'https://www.census.gov/example',
      retrievedAt: '2026-07-20T00:39:41.546Z',
      contentHash: '73eebb',
      createdAt: '2026-07-20T00:39:41.546Z',
    });
    assert.equal(row.decade, 1790);
    assert.equal(row.source, 'us-census-historical-race-1790-1990');
    assert.equal((row.payload as { totalPopulation?: number }).totalPopulation, 3929214);
  });
});
