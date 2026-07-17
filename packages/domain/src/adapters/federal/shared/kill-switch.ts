/**
 * Federal adapter kill-switch identifiers (BB-046 / BB-035 naming).
 * Stable logical ids use the `adapter:<adapterId>` prefix even when the ops
 * kill-switch package is not yet merged.
 */

/** BB-035 logical kill-switch prefix for source adapters. */
export const FEDERAL_ADAPTER_KILL_SWITCH_PREFIX = 'adapter:' as const;

export function federalAdapterKillSwitchId(adapterId: string): string {
  const trimmed = adapterId.trim();
  if (!trimmed) {
    throw new Error('adapterId is required for kill-switch id');
  }
  return `${FEDERAL_ADAPTER_KILL_SWITCH_PREFIX}${trimmed}`;
}

export function parseFederalAdapterKillSwitchId(killSwitchId: string): string | null {
  if (!killSwitchId.startsWith(FEDERAL_ADAPTER_KILL_SWITCH_PREFIX)) {
    return null;
  }
  const adapterId = killSwitchId.slice(FEDERAL_ADAPTER_KILL_SWITCH_PREFIX.length).trim();
  return adapterId || null;
}
