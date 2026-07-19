/**
 * Unit tests for opt-in soft catalog loading in the scheduled discovery runner.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runScheduledDiscovery } from './run-discovery.js';

test('runScheduledDiscovery omits catalog when DISCOVERY_CATALOG_FROM is unset', async () => {
  let catalogLoaderCalls = 0;
  const result = await runScheduledDiscovery({
    jobId: 'discovery-campaign-rss',
    environment: {
      DISCOVERY_MODE: 'fixture',
      DISCOVERY_KILL_SWITCH: 'disengaged',
    },
    readFirestoreDoc: async () => ({ exists: true, data: () => ({ enabled: false }) }),
    loadCatalogProfiles: async () => {
      catalogLoaderCalls += 1;
      return { profiles: [], catalogTitles: [], truncated: false };
    },
  });
  assert.equal(catalogLoaderCalls, 0);
  assert.equal(result.status, 'success');
});

test('runScheduledDiscovery loads soft catalog when DISCOVERY_CATALOG_FROM=firestore', async () => {
  let catalogLoaderCalls = 0;
  const result = await runScheduledDiscovery({
    jobId: 'discovery-campaign-rss',
    environment: {
      DISCOVERY_MODE: 'fixture',
      DISCOVERY_KILL_SWITCH: 'disengaged',
      DISCOVERY_CATALOG_FROM: 'firestore',
      DISCOVERY_CATALOG_MAX: '2',
    },
    readFirestoreDoc: async () => ({ exists: true, data: () => ({ enabled: false }) }),
    loadCatalogProfiles: async () => {
      catalogLoaderCalls += 1;
      return {
        profiles: [
          {
            entity: {
              id: 'ent_test',
              kind: 'person',
              displayName: 'Test Person',
              createdAt: '2026-07-18T00:00:00.000Z',
              updatedAt: '2026-07-18T00:00:00.000Z',
            },
          },
        ],
        catalogTitles: ['Test Person'],
        truncated: false,
      };
    },
  });
  assert.equal(catalogLoaderCalls, 1);
  assert.equal(result.status, 'success');
});
