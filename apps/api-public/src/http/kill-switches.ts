/**
 * Loads vector-search kill switches from ops.kill_switches. Missing rows and query failures
 * produce an empty snapshot, leaving each switch's missingFlagBehavior to decide the outcome.
 * Verify the deployed reader role's grants; a failed read must not be mistaken for an observed
 * disabled switch.
 */
import type { KillSwitchId, KillSwitchSnapshot, KillSwitchState } from '@repo/config';
import { queryPostgres } from './postgres-client.js';

type KillSwitchRow = {
  readonly id: string;
  readonly enabled: boolean;
  readonly reason: string | null;
  readonly updated_at: Date | string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function loadKillSwitchSnapshot(): Promise<KillSwitchSnapshot> {
  let rows: readonly KillSwitchRow[];
  try {
    rows = await queryPostgres<KillSwitchRow>(
      'SELECT id, enabled, reason, updated_at FROM ops.kill_switches',
      [],
    );
  } catch {
    return {};
  }

  const snapshot: Record<string, KillSwitchState> = {};
  for (const row of rows) {
    snapshot[row.id] = {
      id: row.id as KillSwitchId,
      enabled: row.enabled,
      updatedAt: toIso(row.updated_at),
      ...(row.reason ? { reason: row.reason } : {}),
    };
  }
  return snapshot;
}
