/**
 * Shared discovery campaign runner for Firebase scheduled Functions.
 * Calls dispatchDiscoveryCampaign after resolving mode + kill switch. Never publishes.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { dispatchDiscoveryCampaign, type DiscoveryCampaignDispatchResult } from '../../packages/config/src/scheduled-jobs/discovery-dispatcher.js';
import type { KillSwitchDoc } from '../../packages/firebase/src/firestore/types.js';
import { resolveResearchCampaignsKillSwitchEngaged } from './kill-switch-env.js';
import { parseDiscoveryMode } from './mode.js';

function ensureAdminApp(): void {
  if (getApps().length === 0) {
    initializeApp();
  }
}

async function readFirestoreKillSwitchDoc(
  path: string,
): Promise<{ exists: boolean; data: () => KillSwitchDoc | undefined }> {
  ensureAdminApp();
  const snap = await getFirestore().doc(path).get();
  return {
    exists: snap.exists,
    data: () => {
      if (!snap.exists) {
        return undefined;
      }
      return snap.data() as KillSwitchDoc;
    },
  };
}

export type RunScheduledDiscoveryInput = {
  readonly jobId: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  /** Injected for unit tests; production uses Admin Firestore. */
  readonly readFirestoreDoc?: typeof readFirestoreKillSwitchDoc;
};

/**
 * Resolve env + kill switch, then dispatch. Throws only on invalid env; dispatch errors
 * are returned as status error from the dispatcher.
 */
export async function runScheduledDiscovery(
  input: RunScheduledDiscoveryInput,
): Promise<DiscoveryCampaignDispatchResult> {
  const environment = input.environment ?? process.env;
  const mode = parseDiscoveryMode(environment.DISCOVERY_MODE);
  const killSwitchEngaged = await resolveResearchCampaignsKillSwitchEngaged({
    envValue: environment.DISCOVERY_KILL_SWITCH,
    readFirestoreDoc: input.readFirestoreDoc ?? readFirestoreKillSwitchDoc,
  });

  const jobRunId = environment.DISCOVERY_JOB_RUN_ID?.trim();
  const nowIso = environment.DISCOVERY_NOW_ISO?.trim();

  return dispatchDiscoveryCampaign({
    jobId: input.jobId,
    mode,
    killSwitchEngaged,
    ...(jobRunId !== undefined && jobRunId.length > 0 ? { jobRunId } : {}),
    ...(nowIso !== undefined && nowIso.length > 0 ? { nowIso } : {}),
    environment,
  });
}
