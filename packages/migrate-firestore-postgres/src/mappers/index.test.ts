/**
 * Mapper unit tests for high-value Firestore → bb_* row transforms.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractEmbeddingVector,
  mapActiveRelease,
  mapAcsTractProfile,
  mapCensusNationalDecade,
  mapEntityEmbedding,
  mapEntityRelationship,
  mapEvidenceSource,
  mapHateCrimeCountyYear,
  mapKillSwitch,
  mapPolicyActive,
  mapPublicationRelease,
  mapReleaseGraphAdjacency,
  mapReleaseGraphDecade,
  mapResearchCase,
  mapSourceCapture,
  mapSourceItem,
  parseDecadeLabel,
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

  it('maps ACS tract + hate crime with provenance', () => {
    const tract = mapAcsTractProfile('01001020100_2022', {
      geoid11: '01001020100',
      vintage: '2022',
      estimates: { totalPopulation: 100 },
      source: 'acs',
      sourceUrl: 'https://api.census.gov',
      retrievedAt: '2026-07-18T00:00:00.000Z',
      contentHash: 'a'.repeat(64),
    });
    assert.equal(tract.geoid11, '01001020100');
    assert.equal(tract.vintage, 2022);
    const hate = mapHateCrimeCountyYear('36061_2020', {
      fips5: '36061',
      year: '2020',
      incidents: 10,
      source: 'ucr',
      sourceUrl: 'https://example.test',
      retrievedAt: '2026-07-18T00:00:00.000Z',
      contentHash: 'b'.repeat(64),
    });
    assert.equal(hate.year, 2020);
  });
});

describe('graph + embedding mappers', () => {
  it('parses decade labels and maps adjacency', () => {
    assert.equal(parseDecadeLabel('1960s'), 1960);
    const adj = mapReleaseGraphAdjacency('rel_seed_001', 'ent-a', {
      entityId: 'ent-a',
      entries: [],
    });
    assert.equal(adj.release_id, 'rel_seed_001');
    const decade = mapReleaseGraphDecade('rel_seed_001', '1960s', { decade: '1960s', nodes: [] });
    assert.equal(decade?.decade, 1960);
  });

  it('maps relationships and embeddings', () => {
    const rel = mapEntityRelationship('r1', {
      fromEntityId: 'a',
      toEntityId: 'b',
      type: 'attended',
      createdAt: '2026-07-16T18:00:00.000Z',
      updatedAt: '2026-07-16T18:00:00.000Z',
    });
    assert.equal(rel?.from_entity_id, 'a');
    const vector = Array.from({ length: 768 }, (_, i) => i / 768);
    assert.equal(extractEmbeddingVector(vector)?.length, 768);
    const emb = mapEntityEmbedding('ent-a', {
      entityId: 'ent-a',
      kind: 'person',
      vector,
      dims: 768,
      model: 'test',
      sourceTextHash: 'abc',
      updatedAt: '2026-07-16T18:00:00.000Z',
    });
    assert.equal(emb?.entity_id, 'ent-a');
    assert.ok(emb?.embedding.startsWith('['));
  });
});
