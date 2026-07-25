/**
 * Research-campaigns kill switch reads via a minimal DocGetter (no firebase-admin in unit tests).
 * Semantics mirror `@repo/config`'s `evaluateKillSwitch` for `research-campaigns`:
 * `enabled: true` means engaged; a missing doc fails closed (`missingFlagBehavior: deny`).
 *
 * Production should materialize `killSwitches/research-campaigns` so operators can disengage
 * explicitly. Local fixture runs may omit the doc and still observe engaged behavior.
 */
import type { KillSwitchDoc } from '../firestore/types.js';
import { firestorePaths } from '../firestore/paths.js';
import { RESEARCH_CAMPAIGNS_KILL_SWITCH_ID } from './campaign-run.js';

export type KillSwitchDocSnapshot = {
  readonly enabled?: boolean;
};

/** Minimal read surface for kill-switch documents (Firestore Admin or in-memory test double). */
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
  return getter.getDoc(firestorePaths.killSwitch(RESEARCH_CAMPAIGNS_KILL_SWITCH_ID));
}

/** Convenience: fetch then evaluate engagement in one call. */
export async function isResearchCampaignsKillSwitchEngagedIn(getter: DocGetter): Promise<boolean> {
  const doc = await fetchResearchCampaignsKillSwitch(getter);
  return isResearchCampaignsKillSwitchEngaged(doc as KillSwitchDoc | null | undefined);
}
