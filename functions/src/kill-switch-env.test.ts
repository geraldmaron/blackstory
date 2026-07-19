/**
 * Unit tests for kill-switch env override and fail-closed Firestore path.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseKillSwitchEnv,
  resolveResearchCampaignsKillSwitchEngaged,
} from './kill-switch-env.ts';

test('parseKillSwitchEnv accepts engaged/disengaged', () => {
  assert.equal(parseKillSwitchEnv('engaged'), 'engaged');
  assert.equal(parseKillSwitchEnv('disengaged'), 'disengaged');
  assert.equal(parseKillSwitchEnv(undefined), undefined);
});

test('env engaged skips Firestore', async () => {
  const engaged = await resolveResearchCampaignsKillSwitchEngaged({
    envValue: 'engaged',
    readFirestoreDoc: async () => {
      throw new Error('should not read Firestore');
    },
  });
  assert.equal(engaged, true);
});

test('env disengaged skips Firestore', async () => {
  const engaged = await resolveResearchCampaignsKillSwitchEngaged({
    envValue: 'disengaged',
  });
  assert.equal(engaged, false);
});

test('missing Firestore doc fails closed', async () => {
  const engaged = await resolveResearchCampaignsKillSwitchEngaged({
    envValue: undefined,
    readFirestoreDoc: async () => ({ exists: false, data: () => undefined }),
  });
  assert.equal(engaged, true);
});

test('Firestore enabled true is engaged', async () => {
  const engaged = await resolveResearchCampaignsKillSwitchEngaged({
    envValue: undefined,
    readFirestoreDoc: async () => ({
      exists: true,
      data: () => ({
        id: 'research-campaigns',
        enabled: true,
        updatedAt: '2026-07-18T00:00:00.000Z',
      }),
    }),
  });
  assert.equal(engaged, true);
});

test('Firestore enabled false is disengaged', async () => {
  const engaged = await resolveResearchCampaignsKillSwitchEngaged({
    envValue: undefined,
    readFirestoreDoc: async () => ({
      exists: true,
      data: () => ({
        id: 'research-campaigns',
        enabled: false,
        updatedAt: '2026-07-18T00:00:00.000Z',
      }),
    }),
  });
  assert.equal(engaged, false);
});

test('no env and no reader fails closed', async () => {
  const engaged = await resolveResearchCampaignsKillSwitchEngaged({ envValue: undefined });
  assert.equal(engaged, true);
});
