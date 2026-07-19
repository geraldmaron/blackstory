/**
 * Parse DISCOVERY_MODE for scheduled Functions. Default is fixture (safe dry-run).
 */
export type DiscoveryDispatchMode = 'fixture' | 'live';

export function parseDiscoveryMode(
  raw: string | undefined,
  fallback: DiscoveryDispatchMode = 'fixture',
): DiscoveryDispatchMode {
  const value = raw?.trim();
  if (value === undefined || value.length === 0) {
    return fallback;
  }
  if (value !== 'fixture' && value !== 'live') {
    throw new Error('DISCOVERY_MODE must be fixture or live');
  }
  return value;
}
