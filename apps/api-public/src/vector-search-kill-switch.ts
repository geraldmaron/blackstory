/**
 * BB-035 kill-switch wiring for semantic (`find_nearest`) search (BB-071).
 *
 * Deliberately reuses the existing `search` CORE_KILL_SWITCH_IDS entry from
 * `@black-book/config` rather than introducing a new switch id: `packages/config/` is outside
 * this bead's file-ownership allowlist (only additive changes under `packages/firebase/src/`,
 * `apps/api-public/src/`, `packages/domain/src/`|`workers/research/`, the Firestore indexes
 * file, and ADR-014 are in scope), and semantically vector search *is* "dynamic search" per
 * that switch's own description ("Stops dynamic search while immutable entity snapshots remain
 * available."). Reusing it also gets the right cascading behavior for free: `search` is already
 * in `STATIC_MODE_DENIED_SWITCHES`, so `public-static-mode` correctly stops semantic search too
 * (see packages/config/src/kill-switches.ts's `evaluateKillSwitch`).
 *
 * If independent operational control over semantic search specifically (as opposed to text
 * search) is later needed, adding a dedicated `vector-search` core switch id is a small,
 * additive change to packages/config — documented as a gap in ADR-014, not done here.
 */
import { evaluateKillSwitch, type KillSwitchDecision, type KillSwitchSnapshot } from '@black-book/config';

export const VECTOR_SEARCH_KILL_SWITCH_ID = 'search' as const;

export function evaluateVectorSearchKillSwitch(snapshot: KillSwitchSnapshot): KillSwitchDecision {
  return evaluateKillSwitch(VECTOR_SEARCH_KILL_SWITCH_ID, snapshot);
}
