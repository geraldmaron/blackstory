/**
 * Kill-switch identifiers for the Chronicling America adapter.
 * Uses the shared `adapter:<adapterId>` prefix so ops tooling matches federal adapters.
 */

export const CHRONICLING_AMERICA_KILL_SWITCH_PREFIX = 'adapter:' as const;

export function chroniclingAmericaKillSwitchId(adapterId: string): string {
  const trimmed = adapterId.trim();
  if (!trimmed) {
    throw new Error('adapterId is required for kill-switch id');
  }
  return `${CHRONICLING_AMERICA_KILL_SWITCH_PREFIX}${trimmed}`;
}

export function parseChroniclingAmericaKillSwitchId(killSwitchId: string): string | null {
  if (!killSwitchId.startsWith(CHRONICLING_AMERICA_KILL_SWITCH_PREFIX)) {
    return null;
  }
  const adapterId = killSwitchId.slice(CHRONICLING_AMERICA_KILL_SWITCH_PREFIX.length).trim();
  return adapterId || null;
}
