/**
 * Kill-switch identifiers for the BB-073 community discovery adapters (RSS, Internet Archive,
 * DPLA v2). Mirrors `../../federal/shared/kill-switch.ts` (BB-046) exactly — same BB-035
 * logical `adapter:<adapterId>` prefix — so ops tooling that already understands the federal
 * adapters' kill switches needs no special case for the community adapters.
 */

export const COMMUNITY_ADAPTER_KILL_SWITCH_PREFIX = 'adapter:' as const;

export function communityAdapterKillSwitchId(adapterId: string): string {
  const trimmed = adapterId.trim();
  if (!trimmed) {
    throw new Error('adapterId is required for kill-switch id');
  }
  return `${COMMUNITY_ADAPTER_KILL_SWITCH_PREFIX}${trimmed}`;
}

export function parseCommunityAdapterKillSwitchId(killSwitchId: string): string | null {
  if (!killSwitchId.startsWith(COMMUNITY_ADAPTER_KILL_SWITCH_PREFIX)) {
    return null;
  }
  const adapterId = killSwitchId.slice(COMMUNITY_ADAPTER_KILL_SWITCH_PREFIX.length).trim();
  return adapterId || null;
}
