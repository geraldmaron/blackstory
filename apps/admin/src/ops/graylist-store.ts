/** Admin reads for Postgres discovery graylist entries parked below the relevance bar. */
import { queryPostgres } from '@/lib/postgres-client';

export type GraylistListItem = {
  readonly id: string;
  readonly candidateId: string;
  readonly disposition: string;
  readonly status: string;
  readonly compositeScore: number;
  readonly parkedAt: string;
  readonly updatedAt: string;
  readonly reason: string;
  readonly adapterId?: string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function listDiscoveryGraylist(limit = 100): Promise<readonly GraylistListItem[]> {
  const capped = Math.min(200, Math.max(1, limit));
  const rows = await queryPostgres<{
    readonly id: string;
    readonly candidate_id: string;
    readonly disposition: string;
    readonly status: string;
    readonly composite_score: number;
    readonly parked_at: Date | string;
    readonly updated_at: Date | string;
    readonly reason: string;
    readonly adapter_id: string | null;
  }>(
    `SELECT id, candidate_id, disposition, status, composite_score, parked_at, updated_at, reason, adapter_id
     FROM bb_ops.discovery_graylist
     ORDER BY parked_at DESC
     LIMIT $1`,
    [capped],
  );
  return rows.map((row) => ({
    id: row.id,
    candidateId: row.candidate_id,
    disposition: row.disposition,
    status: row.status,
    compositeScore: row.composite_score,
    parkedAt: toIso(row.parked_at),
    updatedAt: toIso(row.updated_at),
    reason: row.reason,
    ...(row.adapter_id ? { adapterId: row.adapter_id } : {}),
  }));
}

export async function tryListDiscoveryGraylist(limit?: number): Promise<readonly GraylistListItem[] | null> {
  try {
    return await listDiscoveryGraylist(limit);
  } catch (error) {
    console.error('admin discovery graylist list failed', error);
    return null;
  }
}
