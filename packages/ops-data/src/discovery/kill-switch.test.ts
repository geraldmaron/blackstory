/** Research dispatch fails closed when its operational kill switch is missing or enabled. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ledgerPaths } from '@repo/data-access';
import type { KillSwitchDoc } from '../records/types.js';
import {
  fetchResearchCampaignsKillSwitch,
  isKillSwitchEngagedFromDoc,
  isResearchCampaignsKillSwitchEngaged,
  isResearchCampaignsKillSwitchEngagedIn,
  type DocGetter,
  type KillSwitchDocSnapshot,
} from './kill-switch.js';

function createGetter(docs: Readonly<Record<string, KillSwitchDocSnapshot>>): DocGetter {
  return {
    async getDoc(path) {
      return docs[path] ?? null;
    },
  };
}

test('missing research-campaigns doc is engaged (missingFlagBehavior deny)', () => {
  assert.equal(isResearchCampaignsKillSwitchEngaged(undefined), true);
  assert.equal(isResearchCampaignsKillSwitchEngaged(null), true);
  assert.equal(isKillSwitchEngagedFromDoc(undefined, 'deny'), true);
  assert.equal(isKillSwitchEngagedFromDoc(undefined, 'allow'), false);
});

test('enabled true means engaged; enabled false means disengaged', () => {
  const engaged: KillSwitchDoc = {
    id: 'research-campaigns',
    enabled: true,
    updatedAt: '2026-07-18T12:00:00.000Z',
  };
  const disengaged: KillSwitchDoc = {
    id: 'research-campaigns',
    enabled: false,
    updatedAt: '2026-07-18T12:00:00.000Z',
  };

  assert.equal(isResearchCampaignsKillSwitchEngaged(engaged), true);
  assert.equal(isResearchCampaignsKillSwitchEngaged(disengaged), false);
});

test('engagement matches research-campaigns deny-on-missing policy', () => {
  const engagedDoc: KillSwitchDoc = {
    id: 'research-campaigns',
    enabled: true,
    updatedAt: '2026-07-18T12:00:00.000Z',
  };
  const disengagedDoc: KillSwitchDoc = {
    id: 'research-campaigns',
    enabled: false,
    updatedAt: '2026-07-18T12:00:00.000Z',
  };

  assert.equal(isResearchCampaignsKillSwitchEngaged(undefined), true);
  assert.equal(isResearchCampaignsKillSwitchEngaged(engagedDoc), true);
  assert.equal(isResearchCampaignsKillSwitchEngaged(disengagedDoc), false);
});

test('fetchResearchCampaignsKillSwitch reads the configured operations switch path', async () => {
  const path = ledgerPaths.killSwitch('research-campaigns');
  const getter = createGetter({
    [path]: { enabled: false },
  });
  const doc = await fetchResearchCampaignsKillSwitch(getter);
  assert.deepEqual(doc, { enabled: false });
});

test('isResearchCampaignsKillSwitchEngagedIn combines fetch and evaluation', async () => {
  const path = ledgerPaths.killSwitch('research-campaigns');
  const engagedGetter = createGetter({ [path]: { enabled: true } });
  const disengagedGetter = createGetter({ [path]: { enabled: false } });
  const missingGetter = createGetter({});

  assert.equal(await isResearchCampaignsKillSwitchEngagedIn(engagedGetter), true);
  assert.equal(await isResearchCampaignsKillSwitchEngagedIn(disengagedGetter), false);
  assert.equal(await isResearchCampaignsKillSwitchEngagedIn(missingGetter), true);
});
