/**
 * Kill-switch wiring for semantic (`find_nearest`) vector search.
 *
 * Reuses the existing `search` CORE_KILL_SWITCH_IDS entry from `@repo/config` rather than
 * introducing a dedicated vector-search switch id. Vector search is classified as "dynamic search"
 * per that switch's description ("Stops dynamic search while immutable entity snapshots remain
 * available."). Reusing it also inherits the right cascading behavior: `search` is already in
 * `STATIC_MODE_DENIED_SWITCHES`, so `public-static-mode` correctly stops semantic search too
 * (see `evaluateKillSwitch` in packages/config/src/kill-switches.ts).
 *
 * If independent operational control over semantic search (as opposed to text search) is later
 * needed, adding a dedicated `vector-search` core switch id is a small, additive change to
 * packages/config (documented as a gap in ADR-014).
 */
import { evaluateKillSwitch, type KillSwitchDecision, type KillSwitchSnapshot } from '@repo/config';

export const VECTOR_SEARCH_KILL_SWITCH_ID = 'search' as const;

export function evaluateVectorSearchKillSwitch(snapshot: KillSwitchSnapshot): KillSwitchDecision {
  return evaluateKillSwitch(VECTOR_SEARCH_KILL_SWITCH_ID, snapshot);
}
