/** Admin reads for operational Postgres kill switches. */
import { listKillSwitchesPostgres } from '@/lib/postgres-ops-reads';

export type KillSwitchListItem = {
  readonly id: string;
  readonly enabled: boolean;
  readonly reason?: string;
  readonly updatedAt: string;
};

export async function listKillSwitches(limit = 100): Promise<readonly KillSwitchListItem[]> {
  return listKillSwitchesPostgres(limit);
}

export async function tryListKillSwitches(limit?: number): Promise<readonly KillSwitchListItem[] | null> {
  try {
    return await listKillSwitches(limit);
  } catch (error) {
    console.error('admin kill switches list failed', error);
    return null;
  }
}
