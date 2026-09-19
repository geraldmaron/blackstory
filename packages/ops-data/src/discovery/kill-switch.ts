/**
 * Research-campaign kill-switch reads through the atomic-store lookup interface.
 * An enabled or missing switch prevents dispatch until explicitly disengaged by an operator.
 */
import type { KillSwitchDoc } from '../records/types.js';
import { ledgerPaths } from '@repo/data-access';
import { RESEARCH_CAMPAIGNS_KILL_SWITCH_ID } from './campaign-run.js';

export type KillSwitchDocSnapshot = {
  readonly enabled?: boolean;
};

/** Minimal read surface for kill-switch documents (Postgres or an in-memory test double). */
export type DocGetter = {
  getDoc(path: string): Promise<KillSwitchDocSnapshot | null | undefined>;
};

/**
 * Thin helper matching `evaluateKillSwitch` engaged/deny semantics from a single doc snapshot.
 * When `missingFlagBehavior` is `deny`, a missing doc is treated as engaged.
 */
export function isKillSwitchEngagedFromDoc(
  doc: KillSwitchDocSnapshot | null | undefined,
  missingFlagBehavior: 'allow' | 'deny',
): boolean {
  if (doc === null || doc === undefined) {
    return missingFlagBehavior === 'deny';
  }
  return doc.enabled === true;
}

/** Returns true when the research-campaigns workload must not dispatch. */
export function isResearchCampaignsKillSwitchEngaged(
  doc: KillSwitchDoc | null | undefined,
): boolean {
  return isKillSwitchEngagedFromDoc(doc, 'deny');
}

/** Reads `killSwitches/research-campaigns` through the supplied getter. */
export async function fetchResearchCampaignsKillSwitch(
  getter: DocGetter,
): Promise<KillSwitchDocSnapshot | null | undefined> {
  return getter.getDoc(ledgerPaths.killSwitch(RESEARCH_CAMPAIGNS_KILL_SWITCH_ID));
}

/** Convenience: fetch then evaluate engagement in one call. */
export async function isResearchCampaignsKillSwitchEngagedIn(getter: DocGetter): Promise<boolean> {
  const doc = await fetchResearchCampaignsKillSwitch(getter);
  return isResearchCampaignsKillSwitchEngaged(doc as KillSwitchDoc | null | undefined);
}
