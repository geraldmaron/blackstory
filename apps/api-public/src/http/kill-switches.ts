/**
 * Loads a `KillSwitchSnapshot` (`@repo/config`) from `bb_ops.kill_switches` for the vector-search
 * endpoint's kill-switch check (`vector-search-kill-switch.ts`). Mirrors the read pattern in
 * `apps/admin/src/lib/postgres-ops-reads.ts` without a cross-app import each app keeps its own
 * thin read over shared Postgres tables (mirrors `postgres-client.ts`'s existing convention).
 *
 * A missing/absent row means "no override configured" (`enabled: false`, not engaged) —
 * `evaluateKillSwitch`'s own `missingFlagBehavior` per-switch default already governs the
 * fail-safe posture for an unconfigured switch; this loader does not need to guess.
 *
 * `bb_ops.kill_switches` grants SELECT only to `postgres`/`service_role` (verified via Supabase
 * `pg_policies`/`role_table_grants`); `apps/api-public`'s pool is documented as scoped to
 * `bb_public.*` reads (`postgres-client.ts`). Rather than assume which role `DATABASE_URL` uses
 * in a given environment, a query failure here degrades to an empty snapshot (no switches
 * engaged) instead of failing the whole request — see `repo-5mdk` for confirming/broadening the
 * grant so this isn't silently degraded in production.
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
      'SELECT id, enabled, reason, updated_at FROM bb_ops.kill_switches',
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
