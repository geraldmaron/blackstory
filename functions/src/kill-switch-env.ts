/**
 * Resolve research-campaigns kill-switch engagement from env override or Firestore.
 * Missing Firestore doc fails closed (engaged). Env DISCOVERY_KILL_SWITCH wins when set.
 */
import {
  firestorePaths,
} from '../../packages/firebase/src/firestore/paths.js';
import { isResearchCampaignsKillSwitchEngaged } from '../../packages/firebase/src/discovery/kill-switch.js';
import { RESEARCH_CAMPAIGNS_KILL_SWITCH_ID } from '../../packages/firebase/src/discovery/campaign-run.js';
import type { KillSwitchDoc } from '../../packages/firebase/src/firestore/types.js';

export type KillSwitchEnv = 'engaged' | 'disengaged';

export function parseKillSwitchEnv(raw: string | undefined): KillSwitchEnv | undefined {
  const value = raw?.trim();
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  if (value !== 'engaged' && value !== 'disengaged') {
    throw new Error('DISCOVERY_KILL_SWITCH must be engaged or disengaged');
  }
  return value;
}

export type FirestoreDocReader = {
  get(path: string): Promise<{ exists: boolean; data: () => KillSwitchDoc | undefined }>;
};

/**
 * Returns true when discovery must not run.
 * Prefer explicit env for local/CI; production should omit env and read Firestore.
 */
export async function resolveResearchCampaignsKillSwitchEngaged(input: {
  readonly envValue: string | undefined;
  readonly readFirestoreDoc?: FirestoreDocReader['get'];
}): Promise<boolean> {
  const fromEnv = parseKillSwitchEnv(input.envValue);
  if (fromEnv !== undefined) {
    return fromEnv === 'engaged';
  }

  if (input.readFirestoreDoc === undefined) {
    // Fail closed when neither env nor Firestore reader is available.
    return true;
  }

  const snap = await input.readFirestoreDoc(
    firestorePaths.killSwitch(RESEARCH_CAMPAIGNS_KILL_SWITCH_ID),
  );
  if (!snap.exists) {
    return isResearchCampaignsKillSwitchEngaged(undefined);
  }
  return isResearchCampaignsKillSwitchEngaged(snap.data());
}
